export type GameMode = 'standard' | 'true_king';
export type GameStatus = 'waiting' | 'setup' | 'active' | 'finished';
export type GameResult = 'white' | 'black' | 'draw' | 'abandoned';
export type PieceColor = 'white' | 'black';

export interface GameState {
  gameId: string;
  roomCode: string;
  gameMode: GameMode;
  whiteGuestId: string | null;
  blackGuestId: string | null;
  fen: string;
  moves: string[];
  status: GameStatus;
  result: GameResult | null;
  turn: PieceColor | null;
  yourColor: PieceColor | null;
  yourTrueKingSquare: string | null;
  yourTrueKingOrigin: string | null;
  needsTrueKingSelection: boolean;
  yourTrueKingReady: boolean;
  opponentReady: boolean;
  timeControl?: string | null;
  clocks?: {
    whiteMs: number;
    blackMs: number;
    activeColor: 'white' | 'black' | null;
    serverNowMs: number;
  } | null;
  yourDisplayName?: string | null;
  opponentDisplayName?: string | null;
}

export interface WsMessage {
  type: 'game_state' | 'error';
  game?: GameState;
  message?: string;
}
