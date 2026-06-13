import { RefreshCw, PlusCircle } from 'lucide-react';

type GameOverModalProps = {
  show: boolean;
  message: string;
  onClose: () => void;
  onRematch?: () => void;
  onNewGame?: () => void;
};

export function GameOverModal({ show, message, onClose, onRematch, onNewGame }: GameOverModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
        <h2 className="text-2xl font-bold mb-2">Game Over</h2>
        <p className="text-muted-foreground mb-8 font-medium">
          {message}
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onRematch}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> Rematch
          </button>
          <button 
            onClick={onNewGame}
            className="w-full py-3 bg-muted text-foreground rounded-lg font-bold hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" /> New Game
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-transparent text-muted-foreground rounded-lg font-bold hover:bg-muted/50 transition-colors mt-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}