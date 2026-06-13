import { Flag, XCircle, MessageSquare, PlaySquare, Handshake } from 'lucide-react';

type GameControlsProps = {
  status: string;
  canAbort: boolean;
  canStartGame: boolean;
  isChatOpen: boolean;
  onToggleChat: () => void;
  onStartGame: () => void;
  onResign?: () => void;
  onDraw?: () => void;
  onAbort?: () => void;
};

export function GameControls({
  status,
  canAbort,
  canStartGame,
  isChatOpen,
  onToggleChat,
  onStartGame,
  onResign,
  onDraw,
  onAbort
}: GameControlsProps) {
  return (
    <div className="flex justify-center gap-4 mt-4 w-full">
      <button
        onClick={onToggleChat}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${
          isChatOpen 
            ? 'bg-primary/20 text-primary border-primary/50' 
            : 'bg-card text-foreground border-border hover:bg-muted'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">Chat</span>
      </button>

      {status === 'active' && canAbort && (
        <button
          onClick={onAbort}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-card text-foreground border border-border hover:bg-muted hover:text-destructive"
        >
          <XCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Abort</span>
        </button>
      )}

      {status === 'active' && !canAbort && (
        <>
          <button
            onClick={onDraw}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-card text-foreground border border-border hover:bg-muted"
          >
            <Handshake className="w-4 h-4" />
            <span className="hidden sm:inline">Offer Draw</span>
          </button>
          <button
            onClick={onResign}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors bg-card text-foreground border border-border hover:bg-muted hover:text-destructive"
          >
            <Flag className="w-4 h-4" />
            <span className="hidden sm:inline">Resign</span>
          </button>
        </>
      )}

      {canStartGame && (
        <button
          onClick={onStartGame}
          className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <PlaySquare className="w-5 h-5" />
          Start Game
        </button>
      )}
    </div>
  );
}