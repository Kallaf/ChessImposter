import { Chess, type Square } from 'chess.js';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Chessboard } from 'react-chessboard';
import { Link, useParams } from 'react-router-dom';
import { getJoinLink } from '../lib/api';
import { fenToPosition, getPieceAt } from '../lib/fen';
import { uciForTrueKingMove } from '../lib/trueKingMoves';
import { trackTrueKingSquare } from '../lib/trueKingTracking';
import { useGameClock } from '../hooks/useGameClock';
import { useGameSocket } from '../hooks/useGameSocket';
import type { ThemeMode } from '../App';
import type { GameState } from '../types/game';
import { Moon, Sun } from 'lucide-react';

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

function formatMoveHistory(moves: string[]): string[] {
  const chess = new Chess(INITIAL_POSITION);

  return moves.map((uci) => {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4) || undefined;

    try {
      const move = chess.move({ from, to, promotion });
      return move?.san ?? uci;
    } catch {
      return uci;
    }
  });
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
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [selectedSquareState, setSelectedSquareState] =
    useState<SelectedSquareState | null>(null);

  useEffect(() => {
    function resize() {
      const w = Math.min(560, window.innerWidth - 48);
      setBoardWidth(Math.max(280, w));
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const isTrueKing = game?.gameMode === 'true_king';
  const inSetup = game?.status === 'setup';
  const canPickTrueKing = Boolean(
    inSetup && game && !game.yourTrueKingReady,
  );
  const canStartGame = Boolean(
    inSetup && game?.yourTrueKingSquare && !game.yourTrueKingReady,
  );

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

  const moveHistory = useMemo(
    () => (game ? formatMoveHistory(game.moves) : []),
    [game],
  );

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
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
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
    [
      canMove,
      canPickTrueKing,
      game,
      legalMoveHintMap,
      selectedSquare,
      sendMove,
      sendTrueKing,
      tryMove,
    ],
  );

  async function copyInvite() {
    if (!game?.roomCode) return;
    await navigator.clipboard.writeText(getJoinLink(game.roomCode));
    setCopyHint('Link copied!');
    window.setTimeout(() => setCopyHint(null), 2000);
  }

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - Navbar */}
      <header className="border-b border-border bg-card shadow-sm">
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
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Board Section */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Status Message */}
              <div className="p-4 sm:p-8 pb-6">
                <h2 className="text-2xl font-semibold text-foreground">
                  {game ? statusMessage(game) : 'Loading game...'}
                </h2>
                {game?.yourColor && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Playing as: <span className="font-medium capitalize">{game.yourColor}</span>
                  </p>
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

              {/* Connection Status */}
              <div className="flex items-center justify-center gap-2 p-4 sm:p-8 pt-6 border-t border-border">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {connected ? 'Connected' : 'Reconnecting...'}
                </span>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <aside className="space-y-6">
            {game && (
              <>
                {/* Player Info */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {(game.yourDisplayName ?? 'G').slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">You</p>
                      <h3 className="text-lg font-medium text-foreground">
                        {game.yourDisplayName ?? 'Guest'}
                      </h3>
                      {game.opponentDisplayName && (
                        <p className="text-sm text-muted-foreground">
                          vs {game.opponentDisplayName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clock */}
                {game.timeControl && (
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">
                      Clock · {game.timeControl}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">White</span>
                        <span
                          className={`text-xl font-mono font-semibold ${
                            clocks?.activeColor === 'white'
                              ? 'text-primary'
                              : 'text-foreground'
                          }`}
                        >
                          {clockDisplay.white}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Black</span>
                        <span
                          className={`text-xl font-mono font-semibold ${
                            clocks?.activeColor === 'black'
                              ? 'text-primary'
                              : 'text-foreground'
                          }`}
                        >
                          {clockDisplay.black}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Room Code */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Room</h3>
                  <div className="font-mono text-sm bg-muted/30 rounded p-3 mb-3 text-foreground break-all">
                    {game.roomCode}
                  </div>
                  <button
                    type="button"
                    onClick={copyInvite}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    Copy Invite
                  </button>
                  {copyHint && (
                    <p className="text-xs text-green-600 mt-2 text-center">{copyHint}</p>
                  )}
                </div>

                {/* Game Status & Actions */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Game Status</h3>
                  <p className="text-foreground mb-4">{statusMessage(game)}</p>
                  
                  {isTrueKing && trueKingHighlightSquare && game.status === 'active' && (
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 mb-3">
                      Your secret king piece is marked in gold
                    </p>
                  )}

                  {canStartGame && (
                    <button
                      type="button"
                      onClick={sendConfirmTrueKing}
                      className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
                    >
                      Start Game
                    </button>
                  )}

                  {isTrueKing && inSetup && game.yourTrueKingReady && (
                    <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                      Your choice is locked in. Waiting for opponent...
                    </p>
                  )}
                </div>

                {/* Move History */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Move History
                    </h3>
                    <span className="text-xs bg-muted text-muted-foreground rounded px-2 py-1">
                      {moveHistory.length} moves
                    </span>
                  </div>
                  {moveHistory.length > 0 ? (
                    <ol className="space-y-1 text-sm max-h-64 overflow-y-auto">
                      {moveHistory.map((move, i) => (
                        <li key={`${i}-${game.moves[i]}`} className="flex gap-2">
                          <span className="text-muted-foreground font-medium min-w-6">
                            {Math.floor(i / 2) + 1}.
                          </span>
                          <span className="font-mono text-foreground">{move}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No moves yet
                    </p>
                  )}
                </div>
              </>
            )}

            {!game && !error && (
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm text-center">
                <p className="text-muted-foreground">Loading game...</p>
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 shadow-sm">
                <p className="text-destructive">{error}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
