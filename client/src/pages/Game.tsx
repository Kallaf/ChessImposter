import { Chess, type Square } from 'chess.js';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { Chessboard } from 'react-chessboard';
import { Link, useParams } from 'react-router-dom';
import { fenToPosition, getPieceAt } from '../lib/fen';
import { uciForTrueKingMove } from '../lib/trueKingMoves';
import { trackTrueKingSquare } from '../lib/trueKingTracking';
import { useGameClock } from '../hooks/useGameClock';
import { useGameSocket } from '../hooks/useGameSocket';
import type { ThemeMode } from '../App';
import type { GameState } from '../types/game';
import { 
  Moon, 
  Sun, 
  Flag, 
  Handshake, 
  XCircle, 
  MessageSquare, 
  PlaySquare,
  User,
  X,
  PlusCircle,
  RefreshCw
} from 'lucide-react';

const INITIAL_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES = 'abcdefgh';
const RANKS = '12345678';
const ALL_SQUARES = FILES.split('').flatMap((file) =>
  RANKS.split('').map((rank) => `${file}${rank}`),
);

type MoveHint = {
  square: string;
  isCapture: boolean;
};

type SelectedSquareState = {
  square: string;
  fen: string;
  turn: string | null;
  status: string;
};

function statusMessage(game: GameState): string {
  if (game.status === 'waiting') return 'Waiting for opponent to join...';
  if (game.status === 'setup') {
    if (game.yourTrueKingReady) {
      return game.opponentReady
        ? 'Starting game...'
        : 'Waiting for opponent to click Start game...';
    }
    if (!game.yourTrueKingSquare) {
      return 'Click one of your pieces to choose your secret king';
    }
    return 'Change your choice if needed, then click Start game';
  }
  if (game.status === 'finished') {
    if (game.gameMode === 'true_king' && game.result) {
      if (game.result === 'draw') return 'Game over - draw';
      if (game.result === 'abandoned') return 'Game over - opponent left';
      const winner = game.result === 'white' ? 'White' : 'Black';
      return `Game over - ${winner} wins (true king captured)`;
    }
    if (game.result === 'draw') return 'Game over - draw';
    if (game.result === 'abandoned') return 'Game over - opponent left';
    if (game.result === 'white') return 'Game over - White wins';
    if (game.result === 'black') return 'Game over - Black wins';
    return 'Game over';
  }
  if (!game.yourColor) return 'Spectating';
  if (game.turn === game.yourColor) return 'Your turn';
  return "Opponent's turn";
}

function squareHasOwnPiece(fen: string, square: string, color: 'w' | 'b'): boolean {
  const piece = getPieceAt(fen, square);
  return piece?.color === color;
}

function isDarkSquare(square: string): boolean {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (fileIndex + rank) % 2 === 1;
}

function pieceCanReachTrueKingSquare(
  fen: string,
  sourceSquare: string,
  targetSquare: string,
  color: 'w' | 'b',
): boolean {
  if (sourceSquare === targetSquare) return false;
  const from = sourceSquare.toLowerCase();
  const to = targetSquare.toLowerCase();
  const piece = getPieceAt(fen, from);
  if (!piece || piece.color !== color) return false;

  const target = getPieceAt(fen, to);
  if (target?.color === color) return false;

  const fromFile = FILES.indexOf(from[0]);
  const toFile = FILES.indexOf(to[0]);
  const fromRank = Number(from[1]);
  const toRank = Number(to[1]);
  if (fromFile < 0 || toFile < 0 || Number.isNaN(fromRank) || Number.isNaN(toRank)) {
    return false;
  }

  const fileDelta = toFile - fromFile;
  const rankDelta = toRank - fromRank;
  const absFile = Math.abs(fileDelta);
  const absRank = Math.abs(rankDelta);
  const direction = color === 'w' ? 1 : -1;

  const pathIsClear = () => {
    const fileStep = Math.sign(fileDelta);
    const rankStep = Math.sign(rankDelta);
    let file = fromFile + fileStep;
    let rank = fromRank + rankStep;

    while (file !== toFile || rank !== toRank) {
      if (getPieceAt(fen, `${FILES[file]}${rank}`)) return false;
      file += fileStep;
      rank += rankStep;
    }

    return true;
  };

  if (piece.type === 'p') {
    const startRank = color === 'w' ? 2 : 7;
    if (fileDelta === 0 && rankDelta === direction && !target) return true;
    if (
      fileDelta === 0 &&
      fromRank === startRank &&
      rankDelta === direction * 2 &&
      !target &&
      !getPieceAt(fen, `${from[0]}${fromRank + direction}`)
    ) {
      return true;
    }
    if (absFile === 1 && rankDelta === direction) {
      if (target && target.color !== color) return true;
      return fen.split(' ')[3] === to;
    }
    return false;
  }

  if (piece.type === 'n') {
    return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  }

  if (piece.type === 'b') return absFile === absRank && pathIsClear();
  if (piece.type === 'r') return (fileDelta === 0 || rankDelta === 0) && pathIsClear();
  if (piece.type === 'q') {
    return (
      (absFile === absRank || fileDelta === 0 || rankDelta === 0) &&
      pathIsClear()
    );
  }
  if (piece.type === 'k') return Math.max(absFile, absRank) === 1;

  return false;
}

function legalMoveHintsForSquare(
  fen: string,
  sourceSquare: string,
  color: 'w' | 'b',
  isTrueKing: boolean,
): MoveHint[] {
  if (isTrueKing) {
    return ALL_SQUARES.filter((targetSquare) =>
      pieceCanReachTrueKingSquare(fen, sourceSquare, targetSquare, color),
    ).map((targetSquare) => ({
      square: targetSquare,
      isCapture: Boolean(getPieceAt(fen, targetSquare)),
    }));
  }

  const chess = new Chess(fen);
  return chess
    .moves({ square: sourceSquare as Square, verbose: true })
    .map((move) => ({
      square: move.to,
      isCapture: move.captured !== undefined,
    }));
}

function lastMoveSquares(moves: string[]): string[] {
  const lastMove = moves.at(-1);
  if (!lastMove || lastMove.length < 4) return [];
  return [lastMove.slice(0, 2), lastMove.slice(2, 4)];
}

const playSound = (type: 'move' | 'start' | 'end') => {
  const audioMap = {
    move: '/sounds/move.mp3',
    start: '/sounds/game-start.mp3',
    end: '/sounds/game-end.mp3'
  };
  const audio = new Audio(audioMap[type]);
  audio.play().catch((e) => console.log('Audio playback prevented by browser:', e));
};

type GameProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export default function Game({ theme, onToggleTheme }: GameProps) {
  const { gameId } = useParams<{ gameId: string }>();
  const { game, clocks, connected, error, sendMove, sendTrueKing, sendConfirmTrueKing } =
    useGameSocket(gameId);
  const clockDisplay = useGameClock(
    clocks ?? game?.clocks ?? null,
    game?.status === 'active',
  );
  
  const [boardWidth, setBoardWidth] = useState(480);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const previousMoveCount = useRef(0);
  const previousStatus = useRef<string | null>(null);

  const [selectedSquareState, setSelectedSquareState] =
    useState<SelectedSquareState | null>(null);

  useEffect(() => {
    if (!game) return;

    if (game.moves && game.moves.length > previousMoveCount.current) {
      playSound('move');
      previousMoveCount.current = game.moves.length;
    }

    if (game.status !== previousStatus.current) {
      if (game.status === 'active') {
        playSound('start');
      } else if (game.status === 'finished') {
        playSound('end');
        setShowEndPopup(true);
      }
      previousStatus.current = game.status;
    }
  }, [game]);

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

  const canMove =
    game &&
    game.status === 'active' &&
    game.yourColor &&
    game.turn === game.yourColor;
  const fen = game?.fen;
  const activePieceColor = game?.yourColor === 'white' ? 'w' : 'b';
  const selectedSquare =
    selectedSquareState &&
    selectedSquareState.fen === fen &&
    selectedSquareState.turn === game?.turn &&
    selectedSquareState.status === game?.status
      ? selectedSquareState.square
      : null;

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

  const recentMoveSquares = useMemo(
    () => (game ? lastMoveSquares(game.moves) : []),
    [game],
  );

  const boardTheme = useMemo(
    () =>
      theme === 'dark'
        ? {
            darkSquare: '#a0724d',
            lightSquare: '#d9c5b0',
            darkNotation: 'rgba(217, 197, 176, 0.72)',
            lightNotation: 'rgba(160, 114, 77, 0.62)',
          }
        : {
            darkSquare: '#a0724d',
            lightSquare: '#f0d9b5',
            darkNotation: 'rgba(240, 217, 181, 0.78)',
            lightNotation: 'rgba(160, 114, 77, 0.58)',
          },
    [theme],
  );

  const squareStyles = useMemo(() => {
    const styledSquares = new Set<string>();
    if (trueKingHighlightSquare) styledSquares.add(trueKingHighlightSquare);
    if (selectedSquare) styledSquares.add(selectedSquare);
    for (const square of recentMoveSquares) styledSquares.add(square);
    for (const hint of legalMoveHints) styledSquares.add(hint.square);

    const styles: Record<string, CSSProperties> = {};

    for (const square of styledSquares) {
      const dark = isDarkSquare(square);
      const baseColor = dark ? boardTheme.darkSquare : boardTheme.lightSquare;
      const backgrounds: string[] = [];
      const shadows: string[] = [];
      const hint = legalMoveHintMap.get(square);

      if (recentMoveSquares.includes(square)) {
        backgrounds.push(
          'linear-gradient(rgba(250, 204, 21, 0.34), rgba(250, 204, 21, 0.34))',
        );
      }

      if (trueKingHighlightSquare === square) {
        backgrounds.push(
          'radial-gradient(circle, rgba(232, 185, 35, 0.24), transparent 64%)',
        );
        shadows.push('inset 0 0 0 4px rgba(232, 185, 35, 0.85)');
      }

      if (hint) {
        const markerColor = dark
          ? 'rgba(248, 250, 252, 0.48)'
          : 'rgba(15, 23, 42, 0.34)';
        backgrounds.push(
          hint.isCapture
            ? `radial-gradient(circle, transparent 0 31%, ${markerColor} 32% 42%, transparent 43%)`
            : `radial-gradient(circle, ${markerColor} 0 15%, transparent 16%)`,
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

  const tryMove = useCallback(
    (sourceSquare: string, targetSquare: string): string | null => {
      if (!game?.yourColor) return null;

      if (isTrueKing) {
        return uciForTrueKingMove(
          game.fen,
          sourceSquare,
          targetSquare,
          game.yourColor,
        );
      }

      const temp = new Chess(game.fen);
      let move = temp.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
      if (!move) {
        const moves = temp.moves({ verbose: true });
        const promotionMove = moves.find(
          (m) =>
            typeof m !== 'string' &&
            m.from === sourceSquare &&
            m.to === targetSquare &&
            m.promotion,
        );
        if (promotionMove && typeof promotionMove !== 'string') {
          move = temp.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: promotionMove.promotion,
          });
        }
      }
      if (move) return move.from + move.to + (move.promotion ?? '');
      return null;
    },
    [game, isTrueKing],
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null; }) => {
      if (!canMove || !targetSquare) return false;
      const uci = tryMove(sourceSquare, targetSquare);
      if (!uci) return false;
      setSelectedSquareState(null);
      sendMove(uci);
      return true;
    },
    [canMove, tryMove, sendMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
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
              },
        );
        return;
      }
      setSelectedSquareState(null);
    },
    [canMove, canPickTrueKing, game, legalMoveHintMap, selectedSquare, sendMove, sendTrueKing, tryMove],
  );

  if (!gameId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Invalid game</p>
          <Link to="/" className="text-primary hover:underline">
            Back to Lobby
          </Link>
        </div>
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
      {/* Header - Navbar */}
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
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Board Layout */}
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
        {game ? (
          <div className="w-full max-w-[600px] flex flex-col gap-4 relative">
            
            {/* Opponent Profile - Top Left */}
            <div className="flex justify-between items-center w-full px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">
                    {game.opponentDisplayName || 'Opponent'}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {game.yourColor === 'white' ? 'Black' : 'White'}
                  </span>
                </div>
              </div>
              {/* Opponent Timer */}
              {game.timeControl && (
                <div className={`px-4 py-2 rounded font-mono text-xl font-bold transition-colors ${
                  oppActive ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-card text-foreground border border-border'
                }`}>
                  {oppClock}
                </div>
              )}
            </div>

              {/* Chessboard - Full Width Container */}
              <div className="flex justify-center items-center bg-background/50 p-4 sm:p-6">
              <Chessboard
                options={{
                  id: 'main-board',
                  position: boardPosition,
                    boardOrientation:
                      game?.yourColor === 'black' ? 'black' : 'white',
                  boardStyle: {
                    width: '100%',
                    maxWidth: boardWidth,
                    aspectRatio: '1',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow:
                        '0 10px 30px rgba(0, 0, 0, 0.2)',
                  },
                  darkSquareStyle: { backgroundColor: boardTheme.darkSquare },
                  lightSquareStyle: { backgroundColor: boardTheme.lightSquare },
                    darkSquareNotationStyle: {
                      color: boardTheme.darkNotation,
                    },
                    lightSquareNotationStyle: {
                      color: boardTheme.lightNotation,
                    },
                    dropSquareStyle: {
                      boxShadow: 'inset 0 0 0 4px rgba(186, 134, 97, 0.75)',
                    },
                  squareStyles,
                  allowDragging: Boolean(canMove),
                  onPieceDrop: onDrop,
                  onSquareClick,
                }}
              />
            </div>

            {/* User Profile - Bottom Right Aligned Content */}
            <div className="flex justify-between items-center w-full px-2 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border border-border">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">
                    {game.yourDisplayName || 'You'}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {game.yourColor}
                  </span>
                </div>
              </div>

              {/* User Timer */}
              {game.timeControl && (
                <div className={`px-4 py-2 rounded font-mono text-xl font-bold transition-colors ${
                  myActive ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-card text-foreground border border-border'
                }`}>
                  {myClock}
                </div>
              )}
            </div>

            {/* True King Pre-Game Messages */}
            {isTrueKing && game.status === 'setup' && (
              <div className="w-full text-center p-3 bg-muted/50 rounded-lg border border-border mt-2">
                <p className="text-sm font-medium">{statusMessage(game)}</p>
              </div>
            )}

            {/* Action Buttons underneath User Profile */}
            <div className="w-full flex items-center justify-between sm:justify-center gap-1 sm:gap-3 mt-2 sm:mt-4 p-2 sm:p-4 bg-card border border-border rounded-xl shadow-sm relative overflow-hidden">
              
              {/* Conditional Action Buttons based on Game Status */}
              {game.status === 'finished' ? (
                <>
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                    <PlusCircle className="w-4 h-4" /> New Game
                  </button>
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                    <RefreshCw className="w-4 h-4" /> Rematch
                  </button>
                </>
              ) : game.status === 'active' ? (
                <>
                  {canAbort ? (
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                      <XCircle className="w-4 h-4" /> Abort
                    </button>
                  ) : (
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                      <Flag className="w-4 h-4" /> Resign
                    </button>
                  )}
                  <button className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                    <Handshake className="w-4 h-4" /> Draw
                  </button>
                </>
              ) : null}

              {/* Chat is always visible except when start button is lone child */}
              {(game.status === 'active' || game.status === 'finished') && (
                 <div className="hidden sm:block w-px h-6 bg-border mx-1" />
              )}
              
              {(!canStartGame) && (
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded transition-colors whitespace-nowrap ${
                    isChatOpen ? 'bg-primary/10 text-primary' : 'hover:bg-primary/10 hover:text-primary text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> Chat
                </button>
              )}
              
              {/* Start Game Button for Setup Phase */}
              {canStartGame && (
                <button
                  type="button"
                  onClick={sendConfirmTrueKing}
                  className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-bold whitespace-nowrap"
                >
                  <PlaySquare className="w-4 h-4" /> Start Game
                </button>
              )}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            {error ? (
              <p className="text-destructive font-medium">{error}</p>
            ) : (
              <p className="text-muted-foreground animate-pulse">Loading board...</p>
            )}
          </div>
        )}
      </div>

      {/* Floating Chat Window Overlay */}
      {isChatOpen && (
        <div className="absolute bottom-6 right-6 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-96 z-40 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center p-3 border-b border-border bg-muted/50">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Game Chat
            </h3>
            <button 
              onClick={() => setIsChatOpen(false)} 
              className="hover:bg-muted/80 text-muted-foreground p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
             <p className="text-xs text-muted-foreground text-center bg-muted/50 py-1 rounded-full">
               Chat started. Say hi!
             </p>
          </div>
          <div className="p-3 border-t border-border bg-card">
            <input 
              type="text" 
              placeholder="Type a message..." 
              className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" 
            />
          </div>
        </div>
      )}

      {/* Game End Modal Popup */}
      {showEndPopup && game?.status === 'finished' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-2">Game Over</h2>
            <p className="text-muted-foreground mb-8 font-medium">
              {statusMessage(game)}
            </p>
            
            <div className="flex flex-col gap-3">
              <button className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5" /> Rematch
              </button>
              <button className="w-full py-3 bg-muted text-foreground rounded-lg font-bold hover:bg-muted/80 transition-colors flex items-center justify-center gap-2">
                <PlusCircle className="w-5 h-5" /> New Game
              </button>
              <button
                onClick={() => setShowEndPopup(false)}
                className="w-full py-3 bg-transparent text-muted-foreground rounded-lg font-bold hover:bg-muted/50 transition-colors mt-2"
              >
                Close
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}