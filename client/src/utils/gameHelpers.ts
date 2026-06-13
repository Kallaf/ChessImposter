import { Chess, type Square } from 'chess.js';
import { getPieceAt } from '../lib/fen';
import type { GameState } from '../types/game';

export const INITIAL_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const FILES = 'abcdefgh';
export const RANKS = '12345678';
export const ALL_SQUARES = FILES.split('').flatMap((file) =>
  RANKS.split('').map((rank) => `${file}${rank}`)
);

export type MoveHint = {
  square: string;
  isCapture: boolean;
};

export type SelectedSquareState = {
  square: string;
  fen: string;
  turn: string | null;
  status: string;
};

export function statusMessage(game: GameState): string {
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

export function squareHasOwnPiece(fen: string, square: string, color: 'w' | 'b'): boolean {
  const piece = getPieceAt(fen, square);
  return piece?.color === color;
}

export function isDarkSquare(square: string): boolean {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (fileIndex + rank) % 2 === 1;
}

export function pieceCanReachTrueKingSquare(
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
  if (fromFile < 0 || toFile < 0 || Number.isNaN(fromRank) || Number.isNaN(toRank)) return false;

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
    ) return true;
    if (absFile === 1 && rankDelta === direction) {
      if (target && target.color !== color) return true;
      return fen.split(' ')[3] === to;
    }
    return false;
  }

  if (piece.type === 'n') return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  if (piece.type === 'b') return absFile === absRank && pathIsClear();
  if (piece.type === 'r') return (fileDelta === 0 || rankDelta === 0) && pathIsClear();
  if (piece.type === 'q') return ((absFile === absRank || fileDelta === 0 || rankDelta === 0) && pathIsClear());
  if (piece.type === 'k') return Math.max(absFile, absRank) === 1;

  return false;
}

export function legalMoveHintsForSquare(
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

export function lastMoveSquares(moves: string[]): string[] {
  const lastMove = moves.at(-1);
  if (!lastMove || lastMove.length < 4) return [];
  return [lastMove.slice(0, 2), lastMove.slice(2, 4)];
}