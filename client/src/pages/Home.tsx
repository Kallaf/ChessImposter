import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createGame, getJoinLink, joinGame } from '../lib/api';
import type { ThemeMode } from '../App';
import type { GameMode } from '../types/game';

type HomeProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export default function Home({ theme, onToggleTheme }: HomeProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomCode, setRoomCode] = useState(
    () => searchParams.get('join')?.toUpperCase() ?? '',
  );
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{
    gameId: string;
    roomCode: string;
  } | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const game = await createGame(gameMode);
      setCreatedRoom({ gameId: game.gameId, roomCode: game.roomCode });
      navigate(`/game/${game.gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const game = await joinGame(roomCode.trim());
      navigate(`/game/${game.gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(getJoinLink(code));
    } catch {
      setError('Could not copy link');
    }
  }

  return (
    <div className="page home-page">
      <header className="site-header app-header">
        <div>
          <span className="eyebrow">Guest chess rooms</span>
          <h1>Chess</h1>
          <p className="subtitle">Play online as a guest with fast rooms and a clean board.</p>
        </div>
        <button type="button" className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <main className="home-shell">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">New match</span>
            <h2>Start a focused chess session in seconds.</h2>
            <p>
              Create a room, choose the rule set, and share the invite with your opponent.
            </p>
          </div>

          <div className="mini-board" aria-hidden="true">
            {Array.from({ length: 64 }, (_, i) => (
              <span key={i} className={(Math.floor(i / 8) + i) % 2 ? 'dark' : 'light'} />
            ))}
          </div>
        </section>

        <section className="action-grid">
          <div className="card action-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Create</span>
                <h2>Create a game</h2>
              </div>
            </div>
            <p>Start a new room and share the code with your opponent.</p>

            <fieldset className="mode-picker">
              <legend>Game mode</legend>
              <label className={gameMode === 'standard' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="gameMode"
                  value="standard"
                  checked={gameMode === 'standard'}
                  onChange={() => setGameMode('standard')}
                />
                <span>
                  <strong>Standard</strong>
                  <small>Normal chess rules</small>
                </span>
              </label>
              <label className={gameMode === 'true_king' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="gameMode"
                  value="true_king"
                  checked={gameMode === 'true_king'}
                  onChange={() => setGameMode('true_king')}
                />
                <span>
                  <strong>True King</strong>
                  <small>Pick a secret piece; lose if it is captured.</small>
                </span>
              </label>
            </fieldset>

            <button
              type="button"
              className="btn primary"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create game'}
            </button>
            {createdRoom && (
              <p className="hint">
                Room: <strong>{createdRoom.roomCode}</strong>{' '}
                <button
                  type="button"
                  className="btn link"
                  onClick={() => copyLink(createdRoom.roomCode)}
                >
                  Copy invite link
                </button>
              </p>
            )}
          </div>

          <div className="card action-card">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Join</span>
                <h2>Join a game</h2>
              </div>
            </div>
            <p>Enter the room code from your invite.</p>
            <form onSubmit={handleJoin}>
              <label htmlFor="roomCode">Room code</label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !roomCode.trim()}
              >
                {loading ? 'Joining...' : 'Join game'}
              </button>
            </form>
          </div>
        </section>
      </main>

      {error && <p className="banner error">{error}</p>}
    </div>
  );
}
