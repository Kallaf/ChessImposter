import { Chess } from 'chess.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Link, useParams } from 'react-router-dom';
import { getJoinLink } from '../lib/api';
import { fenToPosition, getPieceAt } from '../lib/fen';
import { uciForTrueKingMove } from '../lib/trueKingMoves';
import { trackTrueKingSquare } from '../lib/trueKingTracking';
import { useGameSocket } from '../hooks/useGameSocket';
import type { GameState } from '../types/game';

const INITIAL_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function statusMessage(game: GameState): string {
  if (game.status === 'waiting') return 'Waiting for opponent to join…';
  if (game.status === 'setup') {
    if (game.yourTrueKingReady) {
      return game.opponentReady
        ? 'Starting game…'
        : 'Waiting for opponent to click Start game…';
    }
    if (!game.yourTrueKingSquare) {
      return 'Click one of your pieces to choose your secret king';
    }
    return 'Change your choice if needed, then click Start game';
  }
  if (game.status === 'finished') {
    if (game.gameMode === 'true_king' && game.result) {
      if (game.result === 'draw') return 'Game over — draw';
      if (game.result === 'abandoned') return 'Game over — opponent left';
      const winner = game.result === 'white' ? 'White' : 'Black';
      return `Game over — ${winner} wins (true king captured)`;
    }
    if (game.result === 'draw') return 'Game over — draw';
    if (game.result === 'abandoned') return 'Game over — opponent left';
    if (game.result === 'white') return 'Game over — White wins';
    if (game.result === 'black') return 'Game over — Black wins';
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

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const { game, connected, error, sendMove, sendTrueKing, sendConfirmTrueKing } =
    useGameSocket(gameId);
  const [boardWidth, setBoardWidth] = useState(480);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    function resize() {
      const w = Math.min(520, window.innerWidth - 48);
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

  const boardPosition = useMemo(() => {
    if (!game?.fen) return fenToPosition(INITIAL_POSITION);
    if (isTrueKing) return fenToPosition(game.fen);
    return game.fen;
  }, [game?.fen, isTrueKing]);

  const trueKingHighlightSquare = useMemo(() => {
    if (!game || !isTrueKing) return null;
    if (game.status === 'setup') return game.yourTrueKingSquare;
    if (game.status !== 'active' || !game.yourColor) return null;
    const origin = game.yourTrueKingOrigin ?? game.yourTrueKingSquare;
    if (!origin) return game.yourTrueKingSquare;
    return trackTrueKingSquare(origin, game.moves, game.yourColor);
  }, [game, isTrueKing]);

  const squareStyles = useMemo(() => {
    if (!trueKingHighlightSquare) return {};
    return {
      [trueKingHighlightSquare]: {
        boxShadow: 'inset 0 0 0 4px #e8b923',
      },
    };
  }, [trueKingHighlightSquare]);

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
      sendMove(uci);
      return true;
    },
    [canMove, tryMove, sendMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
      if (!canPickTrueKing || !game?.yourColor) return;
      const color = game.yourColor === 'white' ? 'w' : 'b';
      if (!squareHasOwnPiece(game.fen, square, color)) return;
      sendTrueKing(square);
    },
    [canPickTrueKing, game, sendTrueKing],
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
            ← Home
          </Link>
          <h1>Game</h1>
          {isTrueKing && <p className="mode-badge">True King mode</p>}
        </div>
        <span className={`status-dot ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Connected' : 'Reconnecting…'}
        </span>
      </header>

      <div className="game-layout">
        <div className="board-wrap">
          <Chessboard
            options={{
              id: 'main-board',
              position: boardPosition,
              boardOrientation:
                game?.yourColor === 'black' ? 'black' : 'white',
              boardStyle: { width: boardWidth, height: boardWidth },
              squareStyles,
              allowDragging: Boolean(canMove),
              onPieceDrop: onDrop,
              onSquareClick: canPickTrueKing ? onSquareClick : undefined,
            }}
          />
        </div>

        <aside className="side-panel">
          {game && (
            <>
              <div className="panel-block">
                <h2>Room</h2>
                <p className="room-code">{game.roomCode}</p>
                <button type="button" className="btn secondary" onClick={copyInvite}>
                  Copy invite link
                </button>
                {copyHint && <p className="hint">{copyHint}</p>}
              </div>

              <div className="panel-block">
                <h2>Status</h2>
                <p className="status-text">{statusMessage(game)}</p>
                {game.yourColor && game.status === 'active' && (
                  <p className="hint">You are playing as {game.yourColor}</p>
                )}
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
                    Your choice is locked in. Waiting for opponent…
                  </p>
                )}
              </div>

              {game.moves.length > 0 && (
                <div className="panel-block">
                  <h2>Moves</h2>
                  <ol className="move-list">
                    {game.moves.map((uci, i) => (
                      <li key={`${i}-${uci}`}>{uci}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}

          {!game && !error && <p>Loading game…</p>}
          {error && <p className="banner error">{error}</p>}
        </aside>
      </div>
    </div>
  );
}
