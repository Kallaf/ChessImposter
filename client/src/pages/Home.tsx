import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createGame, getJoinLink, joinGame } from '../lib/api';
import type { GameMode } from '../types/game';

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{
    gameId: string;
    roomCode: string;
  } | null>(null);

  useEffect(() => {
    const join = searchParams.get('join');
    if (join) setRoomCode(join.toUpperCase());
  }, [searchParams]);

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
      <header className="site-header">
        <h1>Chess</h1>
        <p className="subtitle">Play online as a guest — no account needed</p>
      </header>

      <div className="card-stack">
        <section className="card">
          <h2>Create a game</h2>
          <p>Start a new room and share the code with your opponent.</p>

          <fieldset className="mode-picker">
            <legend>Game mode</legend>
            <label>
              <input
                type="radio"
                name="gameMode"
                value="standard"
                checked={gameMode === 'standard'}
                onChange={() => setGameMode('standard')}
              />
              Standard — normal chess rules
            </label>
            <label>
              <input
                type="radio"
                name="gameMode"
                value="true_king"
                checked={gameMode === 'true_king'}
                onChange={() => setGameMode('true_king')}
              />
              True King — pick a secret piece; if it is captured, you lose. The
              real king can be taken and play continues.
            </label>
          </fieldset>

          <button
            type="button"
            className="btn primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create game'}
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
        </section>

        <section className="card">
          <h2>Join a game</h2>
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
              {loading ? 'Joining…' : 'Join game'}
            </button>
          </form>
        </section>
      </div>

      {error && <p className="banner error">{error}</p>}
    </div>
  );
}
