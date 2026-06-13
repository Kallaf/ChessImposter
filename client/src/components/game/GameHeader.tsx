import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import type { ThemeMode } from '../../App';

type GameHeaderProps = {
  connected: boolean;
  isTrueKing: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export function GameHeader({ connected, isTrueKing, theme, onToggleTheme }: GameHeaderProps) {
  return (
    <header className="border-b border-border bg-card shadow-sm shrink-0">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-primary hover:text-primary/80 transition-colors">
            ← Back to Lobby
          </Link>
          {isTrueKing && (
            <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded">
              True King Mode
            </span>
          )}
          <span className="ml-4 text-sm text-muted-foreground flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
        <button onClick={onToggleTheme} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}