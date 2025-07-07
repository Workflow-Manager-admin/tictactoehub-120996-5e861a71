import React, { useState, useEffect } from 'react';
import './App.css';

/**
 * Backend base URL handling:
 * - Uses production deployment backend URL by default (fixes fetch/connectivity errors in deployment).
 * - Can override with REACT_APP_API_BASE environment variable for flexibility in future deployments.
 * - For local/dev, update `.env` or set in shell as needed; for deployed preview, adjust as desired below.
 * - This ensures all frontend API traffic targets:
 *     https://vscode-internal-347728-beta.beta01.cloud.kavia.ai:3001
 *   for maximal backend connectivity and to resolve CORS issues.
 */
let API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://vscode-internal-347728-beta.beta01.cloud.kavia.ai:3001";

// --- API HELPERS ---

// PUBLIC_INTERFACE
async function apiStartGame() {
  /** POST /game/new - returns {game_id, board, status, player} */
  const resp = await fetch(`${API_BASE}/game/new`, { method: 'POST' });
  return resp.json();
}

// PUBLIC_INTERFACE
async function apiMakeMove(game_id, x, y) {
  /** POST /game/move - {game_id, x, y} as JSON. Returns full gamestate */
  const resp = await fetch(`${API_BASE}/game/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id, x, y }),
  });
  return resp.json();
}

// PUBLIC_INTERFACE
async function apiGetGame(game_id) {
  /** GET /game/{game_id} - fetches latest board/state */
  const resp = await fetch(`${API_BASE}/game/${game_id}`);
  return resp.json();
}

// PUBLIC_INTERFACE
async function apiLeaderboard() {
  /** GET /leaderboard - returns [{user, wins, losses, draws}] */
  const resp = await fetch(`${API_BASE}/leaderboard`);
  return resp.json();
}

// PUBLIC_INTERFACE
async function apiGameHistory() {
  /** GET /game/history - returns [{game_id, winner, moves, finished_at}] */
  const resp = await fetch(`${API_BASE}/game/history`);
  return resp.json();
}

// --- COMPONENTS ---

function Board({ board, onCellClick, disabled }) {
  // 3x3 grid; board is [['X', '', 'O'...], ...]
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 60px)',
      gap: '8px', justifyContent: 'center', margin: '24px auto'
    }}>
      {board && board.flat().map((cell, idx) => {
        const x = Math.floor(idx / 3), y = idx % 3;
        return (
          <button key={idx}
            className="ttt-cell"
            style={{
              width: 60, height: 60,
              fontSize: "2rem", fontWeight: "bold",
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              borderRadius: '8px',
              color: cell === 'X' ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: !cell && !disabled ? 'pointer' : 'default',
              transition: "background 0.2s"
            }}
            onClick={() => !cell && !disabled && onCellClick(x, y)}
            disabled={!!cell || disabled}
            aria-label={`Cell ${x + 1} ${y + 1}`}
          >{cell || ''}</button>
        );
      })}
    </div>
  );
}

function StatusBar({ status, player, winner, yourTurn }) {
  let msg = "";
  if (winner) {
    msg = winner === "draw"
      ? "It's a draw!"
      : (winner === player
        ? "You win! 🎉"
        : "You lose.");
  } else if (status === "playing") {
    msg = yourTurn ? "Your move" : "Opponent's move";
  } else if (status === "waiting") {
    msg = "Waiting for opponent...";
  } else {
    msg = status || "";
  }
  return <div style={{
    fontSize: "1.2rem",
    margin: "12px 0",
    color: "var(--text-primary)",
    fontWeight: 600
  }}>{msg}</div>;
}

function Leaderboard({ data }) {
  return (
    <div style={{ minWidth: 230, margin: "10px 0" }}>
      <div style={{
        fontWeight: 700, fontSize: "1.2rem", color: "var(--text-primary)",
        borderBottom: "1px solid var(--border-color)", marginBottom: 8
      }}>Leaderboard</div>
      {Array.isArray(data) && !!data.length
        ? (
          <table style={{ width: "100%", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            <thead>
              <tr><th>User</th><th>W</th><th>L</th><th>D</th></tr>
            </thead>
            <tbody>
              {data.map((row, i) =>
                <tr key={i} style={{ textAlign: "center" }}>
                  <td>{row.user}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.draws}</td>
                </tr>
              )}
            </tbody>
          </table>
        )
        : <div>No leaderboard data.</div>
      }
    </div>
  );
}

function History({ games }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        fontWeight: 700, fontSize: "1.2rem", color: "var(--text-primary)",
        borderBottom: "1px solid var(--border-color)", marginBottom: 8
      }}>Game History</div>
      {Array.isArray(games) && games.length > 0 ? (
        <ul style={{
          listStyle: "none", padding: 0, maxHeight: 200, overflowY: "auto",
          textAlign: "left", fontSize: "1rem"
        }}>
          {games.map((g, i) => (
            <li key={i} style={{
              borderBottom: "1px solid var(--border-color)", padding: "5px 0"
            }}>
              Game #{g.game_id}:&nbsp;
              {g.winner === 'draw' ? "Draw" :
                g.winner ? `Winner: ${g.winner}` : "In progress"}
              &nbsp;({(g.finished_at && (new Date(g.finished_at)).toLocaleString()) || ""})
            </li>
          ))}
        </ul>
      ) : (
        <div>No game history yet.</div>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  const [game, setGame] = useState(null); // {game_id, board, status, ...}
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Assume player marker could be 'X' or 'O'. Track from backend payload.
  const player = game?.player;
  const winner = game?.winner;

  // Setup theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load leaderboard/history once on mount
  useEffect(() => {
    apiLeaderboard().then(setLeaderboard);
    apiGameHistory().then(setHistory);
  }, []);

  // Query current game if present (e.g., refresh)
  const refreshGame = async (gid) => {
    setLoading(true);
    try {
      const data = await apiGetGame(gid || game?.game_id);
      setGame(data);
      setError('');
    } catch (e) {
      setError('Error refreshing game.');
    }
    setLoading(false);
  };

  // Start new game
  const startGame = async () => {
    setLoading(true);
    try {
      const data = await apiStartGame();
      setGame(data);
      setError('');
    } catch {
      setError('Failed to start a new game.');
    }
    setLoading(false);
  };

  // Make move
  const makeMove = async (x, y) => {
    setLoading(true);
    try {
      const data = await apiMakeMove(game.game_id, x, y);
      setGame(data);
      setError('');
      // Optionally: refresh leaderboard/history if game ends
      if (data.status === "finished") {
        apiLeaderboard().then(setLeaderboard);
        apiGameHistory().then(setHistory);
      }
    } catch {
      setError('Move failed.');
    }
    setLoading(false);
  };

  // Determine UI flags
  const boardDisabled = loading || !game || game.status !== 'playing' || Boolean(game.winner);
  const yourTurn = !!game && !winner && game.status === 'playing' && game.current_turn === player;

  // UI Layout: header, main, right bar, footer (bare-minimalist)
  return (
    <div className="App" style={{
      minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)"
    }}>
      <header style={{
        padding: "16px 0 9px 0", background: "var(--bg-secondary)",
        color: "var(--text-primary)", fontWeight: 800, fontSize: "2rem"
      }}>
        <span style={{
          color: "#1976d2", marginRight: 8, fontWeight: 800
        }}>Tic Tac Toe</span>
        <button
          className="theme-toggle"
          onClick={() => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>
      <main style={{
        minHeight: 400, display: "flex", justifyContent: "center",
        gap: 36, alignItems: "flex-start", maxWidth: 1000, margin: "0 auto", padding: "32px 8px"
      }}>
        <div>
          <div style={{
            padding: 10, marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center"
          }}>
            {game
              ? <>
                <StatusBar
                  status={game.status}
                  winner={game.winner}
                  player={game.player}
                  yourTurn={yourTurn}
                />
                <Board
                  board={game.board}
                  onCellClick={makeMove}
                  disabled={boardDisabled || !yourTurn}
                />
                <div><strong>Your marker:</strong> {game.player}</div>
                <button
                  onClick={startGame}
                  className="btn"
                  style={{
                    marginTop: 18,
                    background: "#43a047", color: "#fff",
                    border: "none", padding: "12px 30px", borderRadius: 8,
                    fontWeight: 600, fontSize: "1.05rem"
                  }}
                >Start New Game</button>
              </>
              : <button
                onClick={startGame}
                className="btn"
                style={{
                  background: "#1976d2", color: "#ffffff", fontFamily: "Arial, sans-serif",
                  border: "none", padding: "16px 40px", borderRadius: 9,
                  fontSize: "1.1rem", fontWeight: "bold", textAlign: "center"
                }}
              >Start Game!!</button>
            }
            {error && <div style={{ color: 'red', marginTop: 9 }}>{error}</div>}
            {loading && <div style={{ margin: "12px 0", color: "#1976d2" }}>Loading...</div>}
          </div>
        </div>
        <aside style={{ minWidth: 270, maxWidth: 330 }}>
          <Leaderboard data={leaderboard} />
          <History games={history} />
        </aside>
      </main>
      <footer style={{
        padding: 10, fontSize: "0.95rem",
        background: "var(--bg-secondary)", color: "var(--text-secondary)"
      }}>
        Powered by KAVIA · <a
          href="https://reactjs.org/"
          style={{ color: 'var(--text-secondary)' }}
          target="_blank" rel="noopener noreferrer">React</a>
      </footer>
    </div>
  );
}

export default App;
