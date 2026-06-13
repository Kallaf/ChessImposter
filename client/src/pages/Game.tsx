import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useParams, Link } from 'react-router-dom';
import { Chess } from 'chess.js';

import { fenToPosition } from '../lib/fen';
import { uciForTrueKingMove } from '../lib/trueKingMoves';
import { trackTrueKingSquare } from '../lib/trueKingTracking';

import { useGameSocket } from '../hooks/useGameSocket';
import { useGameClock } from '../hooks/useGameClock';
import { useGameEffects } from '../hooks/useGameEffects';

import { 
  INITIAL_POSITION, 
  statusMessage, 
  squareHasOwnPiece, 
  isDarkSquare, 
  legalMoveHintsForSquare, 
  lastMoveSquares, 
  type SelectedSquareState 
} from '../utils/gameHelpers';
import { playSound } from '../utils/audioSystem';

import { GameHeader } from '../components/game/GameHeader';
import { PlayerProfile } from '../components/game/PlayerProfile';
import { GameControls } from '../components/game/GameControls';
import { ChatWindow } from '../components/game/ChatWindow';
import { GameOverModal } from '../components/game/GameOverModal';

import type { ThemeMode } from '../App';
import { useNotification } from '../context/NotificationContext';

type GameProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export default function Game({ theme, onToggleTheme }: GameProps) {
  const { gameId } = useParams<{ gameId: string }>();
  const { 
    game, 
    clocks,
    connected,
    error,
    sendMove,
    sendTrueKing,
    sendConfirmTrueKing,
    abort,
    resign,
    offerDraw, 
  } = useGameSocket(gameId);
  const clockDisplay = useGameClock(clocks ?? game?.clocks ?? null, game?.status === 'active');
  
  const [boardWidth, setBoardWidth] = useState(480);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedSquareState, setSelectedSquareState] = useState<SelectedSquareState | null>(null);

  // Bind audio side effects and automatic modal activations
  useGameEffects(game, setShowEndPopup);

  useEffect(() => {
    function resize() {
      const w = Math.min(800, window.innerWidth - 48);
      setBoardWidth(Math.max(280, w));
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const isTrueKing = game?.gameMode === 'true_king';
  const inSetup = game?.status === 'setup';
  const canPickTrueKing = Boolean(inSetup && game && !game.yourTrueKingReady);
  const canStartGame = Boolean(inSetup && game?.yourTrueKingSquare && !game.yourTrueKingReady);
  const canAbort = (game?.moves?.length ?? 0) < 2;
  const canMove = game?.status === 'active' && game.yourColor && game.turn === game.yourColor;
  
  const fen = game?.fen;
  const activePieceColor = game?.yourColor === 'white' ? 'w' : 'b';
  
  const selectedSquare = useMemo(() => {
    if (
      selectedSquareState &&
      selectedSquareState.fen === fen &&
      selectedSquareState.turn === game?.turn &&
      selectedSquareState.status === game?.status
    ) {
      return selectedSquareState.square;
    }
    return null;
  }, [selectedSquareState, fen, game?.turn, game?.status]);

  const boardPosition = useMemo(() => {
    if (!fen) return fenToPosition(INITIAL_POSITION);
    if (isTrueKing) return fenToPosition(fen);
    return fen;
  }, [fen, isTrueKing]);

  const trueKingHighlightSquare = useMemo(() => {
    if (!game || !isTrueKing) return null;
    if (game.status === 'setup') return game.yourTrueKingSquare;
    if (game.status !== 'active' || !game.yourColor) return null;
    const origin = game.yourTrueKingOrigin ?? game.yourTrueKingSquare;
    if (!origin) return game.yourTrueKingSquare;
    return trackTrueKingSquare(origin, game.moves, game.yourColor);
  }, [game, isTrueKing]);

  const legalMoveHints = useMemo(() => {
    if (!canMove || !fen || !selectedSquare || !activePieceColor) return [];
    return legalMoveHintsForSquare(fen, selectedSquare, activePieceColor, isTrueKing);
  }, [activePieceColor, canMove, fen, isTrueKing, selectedSquare]);

  const legalMoveHintMap = useMemo(() => {
    return new Map(legalMoveHints.map((hint) => [hint.square, hint]));
  }, [legalMoveHints]);

  const recentMoveSquares = useMemo(() => (game ? lastMoveSquares(game.moves) : []), [game]);

  const boardTheme = useMemo(() => theme === 'dark'
    ? { darkSquare: '#a0724d', lightSquare: '#d9c5b0', darkNotation: 'rgba(217, 197, 176, 0.72)', lightNotation: 'rgba(160, 114, 77, 0.62)' }
    : { darkSquare: '#a0724d', lightSquare: '#f0d9b5', darkNotation: 'rgba(240, 217, 181, 0.78)', lightNotation: 'rgba(160, 114, 77, 0.58)' },
  [theme]);

  // Restored full background/shadow indicator processor
  const squareStyles = useMemo(() => {
    const styledSquares = new Set<string>();
    if (trueKingHighlightSquare) styledSquares.add(trueKingHighlightSquare);
    if (selectedSquare) styledSquares.add(selectedSquare);
    for (const square of recentMoveSquares) styledSquares.add(square);
    for (const hint of legalMoveHints) styledSquares.add(hint.square);

    const styles: Record<string, React.CSSProperties> = {};

    for (const square of styledSquares) {
      const dark = isDarkSquare(square);
      const baseColor = dark ? boardTheme.darkSquare : boardTheme.lightSquare;
      const backgrounds: string[] = [];
      const shadows: string[] = [];
      const hint = legalMoveHintMap.get(square);

      if (recentMoveSquares.includes(square)) {
        backgrounds.push('linear-gradient(rgba(250, 204, 21, 0.34), rgba(250, 204, 21, 0.34))');
      }

      if (trueKingHighlightSquare === square) {
        backgrounds.push('radial-gradient(circle, rgba(232, 185, 35, 0.24), transparent 64%)');
        shadows.push('inset 0 0 0 4px rgba(232, 185, 35, 0.85)');
      }

      if (hint) {
        const markerColor = dark ? 'rgba(248, 250, 252, 0.48)' : 'rgba(15, 23, 42, 0.34)';
        backgrounds.push(
          hint.isCapture
            ? `radial-gradient(circle, transparent 0 31%, ${markerColor} 32% 42%, transparent 43%)`
            : `radial-gradient(circle, ${markerColor} 0 15%, transparent 16%)`
        );
      }

      if (selectedSquare === square) {
        shadows.push('inset 0 0 0 4px rgba(56, 189, 248, 0.78)');
      }

      styles[square] = {
        background: [...backgrounds, baseColor].join(', '),
        boxShadow: shadows.join(', ') || undefined,
        cursor: hint || selectedSquare === square ? 'pointer' : undefined,
      };
    }

    return styles;
  }, [
    boardTheme.darkSquare,
    boardTheme.lightSquare,
    legalMoveHintMap,
    legalMoveHints,
    recentMoveSquares,
    selectedSquare,
    trueKingHighlightSquare,
  ]);

  const tryMove = useCallback((sourceSquare: string, targetSquare: string): string | null => {
    if (!game?.yourColor) return null;
    if (isTrueKing) return uciForTrueKingMove(game.fen, sourceSquare, targetSquare, game.yourColor);

    const temp = new Chess(game.fen);
    let move = temp.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (!move) {
      const moves = temp.moves({ verbose: true });
      const promotionMove = moves.find((m) => typeof m !== 'string' && m.from === sourceSquare && m.to === targetSquare && m.promotion);
      if (promotionMove && typeof promotionMove !== 'string') {
        move = temp.move({ from: sourceSquare, to: targetSquare, promotion: promotionMove.promotion });
      }
    }
    return move ? move.from + move.to + (move.promotion ?? '') : null;
  }, [game, isTrueKing]);

  // Object-destructured context to support react-chessboard's onPieceDrop pattern
  const onDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!canMove || !targetSquare) return false;
    const uci = tryMove(sourceSquare, targetSquare);
    if (!uci) {
      playSound('illegal');
      return false;
    }
    setSelectedSquareState(null);
    sendMove(uci);
    return true;
  }, [canMove, tryMove, sendMove]);

  // Object-destructured context to fix: 'square.toLowerCase is not a function'
  const onSquareClick = useCallback(({ square }: { square: string }) => {
    if (!game?.yourColor) return;
    const color = game.yourColor === 'white' ? 'w' : 'b';

    if (canPickTrueKing) {
      if (!squareHasOwnPiece(game.fen, square, color)) return;
      sendTrueKing(square);
      return;
    }

    if (!canMove) return;

    const clickedOwnPiece = squareHasOwnPiece(game.fen, square, color);
    if (selectedSquare && legalMoveHintMap.has(square)) {
      const uci = tryMove(selectedSquare, square);
      if (uci) {
        setSelectedSquareState(null);
        sendMove(uci);
      } else {
        playSound('illegal');
      }
      return;
    }

    if (clickedOwnPiece) {
      setSelectedSquareState(
        selectedSquare === square
          ? null
          : {
              square,
              fen: game.fen,
              turn: game.turn,
              status: game.status,
            }
      );
      return;
    }
    setSelectedSquareState(null);
  }, [canMove, canPickTrueKing, game, legalMoveHintMap, selectedSquare, sendMove, sendTrueKing, tryMove]);

  if (!gameId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center"><p className="text-lg mb-4">Invalid game</p><Link to="/" className="text-primary hover:underline">Back to Lobby</Link></div>
      </div>
    );
  }

  const isWhite = game?.yourColor === 'white';
  const myClock = isWhite ? clockDisplay.white : clockDisplay.black;
  const oppClock = isWhite ? clockDisplay.black : clockDisplay.white;

  const myActive = clocks?.activeColor === game?.yourColor;
  const oppActive = clocks?.activeColor !== game?.yourColor && game?.status === 'active';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <GameHeader connected={connected} isTrueKing={isTrueKing} theme={theme} onToggleTheme={onToggleTheme} />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
        {game ? (
          <div className="w-full max-w-[600px] flex flex-col gap-4 relative">
            
            <PlayerProfile 
              name={game.opponentDisplayName || 'Opponent'} 
              color={game.yourColor === 'white' ? 'Black' : 'White'} 
              clockTime={game.timeControl ? oppClock : undefined} 
              isActive={oppActive} 
            />

            <div className="flex justify-center items-center bg-background/50 p-4 sm:p-6">
              <Chessboard
                options={{
                  id: 'main-board',
                  position: boardPosition,
                  boardOrientation: game?.yourColor === 'black' ? 'black' : 'white',
                  boardStyle: { width: '100%', maxWidth: boardWidth, aspectRatio: '1', borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)' },
                  darkSquareStyle: { backgroundColor: boardTheme.darkSquare },
                  lightSquareStyle: { backgroundColor: boardTheme.lightSquare },
                  darkSquareNotationStyle: { color: boardTheme.darkNotation },
                  lightSquareNotationStyle: { color: boardTheme.lightNotation },
                  dropSquareStyle: { boxShadow: 'inset 0 0 0 4px rgba(186, 134, 97, 0.75)' },
                  squareStyles,
                  allowDragging: Boolean(canMove),
                  onPieceDrop: onDrop,
                  onSquareClick,
                }}
              />
            </div>

            <PlayerProfile 
              name={game.yourDisplayName || 'You'} 
              color={game.yourColor || ''} 
              clockTime={game.timeControl ? myClock : undefined} 
              isActive={myActive} 
            />

            {isTrueKing && game.status === 'setup' && (
              <div className="w-full text-center p-3 bg-muted/50 rounded-lg border border-border mt-2">
                <p className="text-sm font-medium">{statusMessage(game)}</p>
              </div>
            )}

            <GameControls 
              status={game.status} 
              canAbort={canAbort}
              onAbort={abort}
              onResign={resign}
              canStartGame={canStartGame} 
              isChatOpen={isChatOpen} 
              onToggleChat={() => setIsChatOpen(!isChatOpen)} 
              onDraw={offerDraw}
              onStartGame={sendConfirmTrueKing} 
            />

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            {error ? <p className="text-destructive font-medium">{error}</p> : <p className="text-muted-foreground animate-pulse">Loading board...</p>}
          </div>
        )}
      </div>

      <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <GameOverModal show={showEndPopup && game?.status === 'finished'} message={game ? statusMessage(game) : ''} onClose={() => setShowEndPopup(false)} />
    </div>
  );
}