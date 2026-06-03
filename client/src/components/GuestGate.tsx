import { useState } from 'react';
import { generateGuestName, setDisplayName } from '../lib/guest';
import { Crown, Moon, Sun } from 'lucide-react';

type Props = {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onReady: () => void;
};

export default function GuestGate({ theme, onToggleTheme, onReady }: Props) {
  const [name, setName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim() || generateGuestName();
    setDisplayName(finalName);
    onReady();
  }

  return (
        <div className="min-h-screen bg-background text-foreground">
      {/* Header - Navbar */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">ChessMaster</span>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      
      <div className="guest-gate">
        <div className="guest-gate-card">
          <p className="guest-gate-eyebrow">Welcome</p>
          <h1>Enter the arena</h1>
          <p className="guest-gate-sub">
            No account needed. Pick a display name and join the live lobby.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TacticalTiger"
              maxLength={32}
              autoFocus
            />
            <button type="submit" className="btn primary">
              Enter lobby
            </button>
          </form>
          <p className="hint">Leave blank for a random guest name.</p>
        </div>
      </div>
    </div>
  );
}
