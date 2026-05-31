import { getPieceAt } from './fen';

/**
 * Build UCI for true-king mode. Does not use chess.js so positions without a
 * king (after the real king is captured) still work.
 */
export function uciForTrueKingMove(
  fen: string,
  sourceSquare: string,
  targetSquare: string,
  yourColor: 'white' | 'black',
): string | null {
  if (sourceSquare === targetSquare) return null;

  const color = yourColor === 'white' ? 'w' : 'b';
  const from = sourceSquare.toLowerCase();
  const to = targetSquare.toLowerCase();
  const piece = getPieceAt(fen, from);
  if (!piece || piece.color !== color) return null;

  const promoRank = color === 'w' ? '8' : '1';
  if (piece.type === 'p' && to[1] === promoRank) {
    return from + to + 'q';
  }

  return from + to;
}
