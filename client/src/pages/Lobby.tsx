import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbySocket } from '../hooks/useLobbySocket';
import { getDisplayName, getGuestId } from '../lib/guest';
import type { ThemeMode } from '../App';

const TIME_OPTIONS = [
  { key: '1+0', label: 'Bullet 1+0', category: 'Bullet' },
  { key: '2+1', label: 'Bullet 2+1', category: 'Bullet' },
  { key: '3+0', label: 'Blitz 3+0', category: 'Blitz' },
  { key: '3+2', label: 'Blitz 3+2', category: 'Blitz' },
  { key: '5+0', label: 'Blitz 5+0', category: 'Blitz' },
  { key: '10+0', label: 'Rapid 10+0', category: 'Rapid' },
  { key: '15+10', label: 'Rapid 15+10', category: 'Rapid' },
];

type Props = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export default function Lobby({ theme, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const [timeControl, setTimeControl] = useState('5+0');
  const [sidePreference, setSidePreference] = useState('random');
  const [gameMode, setGameMode] = useState<'standard' | 'true_king'>('standard');
  const [chatInput, setChatInput] = useState('');

  const lobby = useLobbySocket(true);

  useEffect(() => {
    lobby.onGameStarted((gameId) => {
      navigate(`/game/${gameId}`);
    });
  }, [lobby, navigate]);

  const myId = getGuestId();
  const myChallenge = lobby.challenges.find((c) => c.creatorGuestId === myId);

  function handleCreate() {
    lobby.createChallenge(timeControl, sidePreference, gameMode);
  }

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    lobby.sendChat(chatInput.trim());
    setChatInput('');
  }

  return (
    <div className="page lobby-page">
      <header className="site-header row">
        <div>
          <h1>Chess Lobby</h1>
          <p className="subtitle">
            Welcome, <strong>{getDisplayName()}</strong> · {lobby.onlineCount} online
          </p>
        </div>
        <div className="header-actions">
          <span className={`status-dot ${lobby.connected ? 'online' : 'offline'}`}>
            {lobby.connected ? 'Live' : 'Reconnecting…'}
          </span>
          <button type="button" className="btn secondary" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        <main className="lobby-main">
          <section className="card">
            <h2>Create challenge</h2>
            <div className="form-grid">
              <label>
                Time control
                <select
                  value={timeControl}
                  onChange={(e) => setTimeControl(e.target.value)}
                >
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Your side
                <select
                  value={sidePreference}
                  onChange={(e) => setSidePreference(e.target.value)}
                >
                  <option value="random">Random</option>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                </select>
              </label>
              <label>
                Mode
                <select
                  value={gameMode}
                  onChange={(e) =>
                    setGameMode(e.target.value as 'standard' | 'true_king')
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="true_king">True King</option>
                </select>
              </label>
            </div>
            <div className="lobby-actions">
              <button
                type="button"
                className="btn primary"
                onClick={handleCreate}
                disabled={Boolean(myChallenge)}
              >
                {myChallenge ? 'Challenge posted' : 'Post challenge'}
              </button>
              {myChallenge && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => lobby.cancelChallenge(myChallenge.challengeId)}
                >
                  Cancel
                </button>
              )}
            </div>
          </section>

          <section className="card">
            <h2>Open challenges</h2>
            {lobby.challenges.length === 0 && (
              <p className="hint">No open challenges. Post one to get started.</p>
            )}
            <ul className="challenge-list">
              {lobby.challenges.map((c) => (
                <li key={c.challengeId} className="challenge-row">
                  <div>
                    <strong>{c.creatorName}</strong>
                    <span className="challenge-meta">
                      {c.timeControl} · {c.sidePreference} · {c.gameMode}
                    </span>
                  </div>
                  {c.creatorGuestId !== myId ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => lobby.joinChallenge(c.challengeId)}
                    >
                      Join
                    </button>
                  ) : (
                    <span className="hint">Yours</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </main>

        <aside className="card lobby-chat">
          <h2>Global chat</h2>
          <div className="chat-feed">
            {lobby.chat.map((m, i) => (
              <p key={`${m.sentAt}-${i}`} className="chat-line">
                <strong>{m.displayName}:</strong> {m.message}
              </p>
            ))}
          </div>
          <form onSubmit={handleChat} className="chat-form">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say hello…"
              maxLength={500}
            />
            <button type="submit" className="btn secondary">
              Send
            </button>
          </form>
        </aside>
      </div>

      {lobby.error && <p className="banner error">{lobby.error}</p>}
    </div>
  );
}
