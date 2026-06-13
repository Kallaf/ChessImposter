import { useEffect, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { playSound, unlockAudioEngine } from '../utils/audioSystem';
import { INITIAL_POSITION } from '../utils/gameHelpers';
import type { GameState } from '../types/game';

export function useGameEffects(game: GameState | null, setShowEndPopup: (show: boolean) => void) {
  const previousMoveCount = useRef(0);
  const previousStatus = useRef<string | null>(null);
  const previousFen = useRef<string>(INITIAL_POSITION);

  useEffect(() => {
    const unlock = () => {
      unlockAudioEngine();
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  useEffect(() => {
    if (!game) return;

    if (game.status !== previousStatus.current) {
      if (game.status === 'active') playSound('game-start');
      else if (game.status === 'finished') {
        playSound('game-end');
        setShowEndPopup(true);
      }
      previousStatus.current = game.status;
    }

    if (game.moves && game.moves.length > previousMoveCount.current) {
      const isTrueKingMode = game.gameMode === 'true_king';
      const isMyTurnNow = game.turn === game.yourColor;
      const baseMoveSound = isMyTurnNow ? 'move-opponent' : 'move-self';

      if (!isTrueKingMode && previousFen.current) {
        try {
          const tempChess = new Chess(previousFen.current);
          const lastMoveUci = game.moves[game.moves.length - 1]; 
          const from = lastMoveUci.slice(0, 2) as Square;
          const to = lastMoveUci.slice(2, 4) as Square;
          const promotion = lastMoveUci[4];
          const moveDetails = tempChess.move({ from, to, promotion });

          if (moveDetails) {
            if (tempChess.isCheck()) playSound('move-check');
            else if (moveDetails.promotion) playSound('promote');
            else if (moveDetails.captured) playSound('capture');
            else if (moveDetails.flags.includes('k') || moveDetails.flags.includes('q')) playSound('castle');
            else playSound(baseMoveSound);
          } else {
            playSound(baseMoveSound);
          }
        } catch {
          playSound(baseMoveSound); 
        }
      } else {
        playSound(baseMoveSound);
      }
      previousMoveCount.current = game.moves.length;
    }
    if (game.fen) previousFen.current = game.fen;
  }, [game, setShowEndPopup]);
}