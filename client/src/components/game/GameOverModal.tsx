import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, PlusCircle } from 'lucide-react';
import { useLobbySocket } from '../../hooks/useLobbySocket';
import { WaitingView } from './WaitingView'; // Adjust import path as needed
import type { GameState } from '../../types/game';

type GameOverModalProps = {
  show: boolean;
  message: string;
  onClose: () => void;
  onRematch?: () => void;
  currentGame?: GameState;
};

type PendingAction = 'none' | 'rematch' | 'new-game';

export function GameOverModal({ show, message, onClose, onRematch, currentGame }: GameOverModalProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>('none');
  const navigate = useNavigate();
  
  const { createChallenge, onGameStarted } = useLobbySocket(true);

  // Navigate when socket confirms the game has started
  useEffect(() => {
    onGameStarted((gameId) => {
      setPendingAction('none');
      navigate(`/game/${gameId}`);
    });
  }, [navigate, onGameStarted]);

  // Reset state if the modal visibility changes
  useEffect(() => {
    if (!show) setPendingAction('none');
  }, [show]);

  if (!show) return null;

  const handleRematch = () => {
    setPendingAction('rematch');
    onRematch?.();
  };

  const handleNewGame = () => {
    setPendingAction('new-game');
    createChallenge(currentGame?.timeControl || "5+0", "random", currentGame?.gameMode);
  };

  const handleCancelWait = () => {
    setPendingAction('none');
    // Note: If you need to emit a "cancel challenge" socket event to the server, 
    // you would call it right here.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
        
        {/* Only show the Game Over header if we aren't waiting for a new game */}
        {pendingAction === 'none' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold mb-2">Game Over</h2>
            <p className="text-muted-foreground mb-8 font-medium">
              {message}
            </p>
          </div>
        )}

        {/* View Switcher: Waiting Animation vs Default Buttons */}
        {pendingAction !== 'none' ? (
          <WaitingView action={pendingAction} onCancel={handleCancelWait} />
        ) : (
          <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            <button 
              onClick={handleRematch}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> Rematch
            </button>
            <button 
              onClick={handleNewGame}
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
        )}
      </div>
    </div>
  );
}