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
import { useGameSocket } from '../hooks/useGameSocket';
import type { ThemeMode } from '../App';
import type { GameState } from '../types/game';

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
  const { game, connected, error, sendMove, sendTrueKing, sendConfirmTrueKing } =
    useGameSocket(gameId);
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
            darkSquare: '#1e293b',
            lightSquare: '#f2eadc',
            darkNotation: 'rgba(242, 234, 220, 0.72)',
            lightNotation: 'rgba(30, 41, 59, 0.62)',
          }
        : {
            darkSquare: '#64748b',
            lightSquare: '#fff7ed',
            darkNotation: 'rgba(255, 247, 237, 0.78)',
            lightNotation: 'rgba(51, 65, 85, 0.58)',
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
      <div className="page">
        <p>Invalid game</p>
        <Link to="/">Back home</Link>
      </div>
    );
  }

  return (
    <div className="page game-page">
      <header className="site-header row">
        <div>
          <Link to="/" className="back-link">
            Back home
          </Link>
          <h1>Chess Dashboard</h1>
          {isTrueKing && <p className="mode-badge">True King mode</p>}
        </div>
        <div className="header-actions">
          <button type="button" className="theme-toggle" onClick={onToggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <span className={`status-dot ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
      </header>

      <div className="game-layout">
        <main className="board-stage" aria-label="Chess board">
          <div className="board-meta">
            <div>
              <span className="eyebrow">Live board</span>
              <h2>{game ? statusMessage(game) : 'Loading game...'}</h2>
            </div>
            {game?.yourColor && <span className="color-chip">{game.yourColor}</span>}
          </div>

          <div className="board-wrap">
            <Chessboard
              options={{
                id: 'main-board',
                position: boardPosition,
                boardOrientation:
                  game?.yourColor === 'black' ? 'black' : 'white',
                boardStyle: {
                  width: boardWidth,
                  height: boardWidth,
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow:
                    '0 30px 80px rgba(2, 6, 23, 0.48), 0 0 0 1px rgba(226, 232, 240, 0.12)',
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
                  boxShadow: 'inset 0 0 0 4px rgba(56, 189, 248, 0.75)',
                },
                squareStyles,
                allowDragging: Boolean(canMove),
                onPieceDrop: onDrop,
                onSquareClick,
              }}
            />
          </div>
        </main>

        <aside className="side-panel">
          {game && (
            <>
              <section className="profile-card">
                <div className="avatar" aria-hidden="true">
                  G
                </div>
                <div>
                  <span className="eyebrow">Player profile</span>
                  <h2>Guest Player</h2>
                  <p>{game.yourColor ? `${game.yourColor} side` : 'Spectator'}</p>
                </div>
              </section>

              <section className="panel-block room-panel">
                <div>
                  <h2>Room</h2>
                  <p className="room-code">{game.roomCode}</p>
                </div>
                <button type="button" className="btn secondary" onClick={copyInvite}>
                  Copy invite
                </button>
                {copyHint && <p className="hint">{copyHint}</p>}
              </section>

              <section className="panel-block">
                <h2>Game status</h2>
                <p className="status-text">{statusMessage(game)}</p>
                {isTrueKing && trueKingHighlightSquare && game.status === 'active' && (
                  <p className="hint">
                    Your secret king piece is marked in gold and moves with that
                    piece
                  </p>
                )}
                {canStartGame && (
                  <button
                    type="button"
                    className="btn primary start-game-btn"
                    onClick={sendConfirmTrueKing}
                  >
                    Start game
                  </button>
                )}
                {isTrueKing && inSetup && game.yourTrueKingReady && (
                  <p className="hint">
                    Your choice is locked in. Waiting for opponent...
                  </p>
                )}
              </section>

              <section className="panel-block moves-panel">
                <div className="panel-heading">
                  <h2>Move history</h2>
                  <span>{moveHistory.length} moves</span>
                </div>
                {moveHistory.length > 0 ? (
                  <ol className="move-list">
                    {moveHistory.map((move, i) => (
                      <li key={`${i}-${game.moves[i]}`}>
                        <span>{Math.floor(i / 2) + 1}</span>
                        <strong>{move}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="empty-log">No moves yet</p>
                )}
              </section>
            </>
          )}

          {!game && !error && <p>Loading game...</p>}
          {error && <p className="banner error">{error}</p>}
        </aside>
      </div>
    </div>
  );
}
