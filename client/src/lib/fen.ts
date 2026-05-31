/** Piece on a square (react-chessboard format). */
export type BoardPiece = { pieceType: string };

export type BoardPosition = Record<string, BoardPiece>;

const FILES = 'abcdefgh';

/** Parse board placement from FEN (works without kings — unlike chess.js). */
export function fenToPosition(fen: string): BoardPosition {
  const position: BoardPosition = {};
  const placement = fen.split(' ')[0];
  const rows = placement.split('/');

  for (let row = 0; row < rows.length; row++) {
    let col = 0;
    const rank = 8 - row;
    for (const char of rows[row]) {
      if (char >= '1' && char <= '8') {
        col += parseInt(char, 10);
      } else {
        const isWhite = char === char.toUpperCase();
        const kind = char.toUpperCase();
        const square = `${FILES[col]}${rank}`;
        position[square] = {
          pieceType: `${isWhite ? 'w' : 'b'}${kind}`,
        };
        col += 1;
      }
    }
  }
  return position;
}

export function getPieceAt(
  fen: string,
  square: string,
): { color: 'w' | 'b'; type: string } | null {
  const position = fenToPosition(fen);
  const piece = position[square.toLowerCase()];
  if (!piece) return null;
  const code = piece.pieceType;
  return {
    color: code[0] as 'w' | 'b',
    type: code[1].toLowerCase(),
  };
}

export function fenToBoardPosition(fen: string): BoardPosition | string {
  try {
    return fenToPosition(fen);
  } catch {
    return fen;
  }
}
