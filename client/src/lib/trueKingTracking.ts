import type { PieceColor } from '../types/game';

/** Follow the secret king piece through move list (matches server rules). */
export function trackTrueKingSquare(
  originSquare: string,
  moves: string[],
  color: PieceColor,
): string {
  let square = originSquare.toLowerCase();
  const isWhite = color === 'white';

  for (let i = 0; i < moves.length; i++) {
    const whiteMove = i % 2 === 0;
    if (whiteMove !== isWhite) continue;

    const uci = moves[i].toLowerCase();
    if (uci.length < 4) continue;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);

    if (from === square) {
      square = to;
      continue;
    }

    // Castling: rook of secret king moves with the king
    if (from === 'e1' && to === 'g1' && square === 'h1') square = 'f1';
    else if (from === 'e1' && to === 'c1' && square === 'a1') square = 'd1';
    else if (from === 'e8' && to === 'g8' && square === 'h8') square = 'f8';
    else if (from === 'e8' && to === 'c8' && square === 'a8') square = 'd8';
  }

  return square;
}
