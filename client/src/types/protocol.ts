import type { GameMode, GameState } from './game';

export interface ClockSync {
  whiteMs: number;
  blackMs: number;
  activeColor: 'white' | 'black' | null;
  serverNowMs: number;
}

export interface Challenge {
  challengeId: string;
  creatorGuestId: string;
  creatorName: string;
  timeControl: string;
  sidePreference: 'white' | 'black' | 'random';
  gameMode: GameMode;
  createdAt: string;
}

export interface LobbyState {
  challenges: Challenge[];
  onlineCount: number;
}

export interface GameStartedPayload {
  gameId: string;
  roomCode: string;
  whiteGuestId: string;
  blackGuestId: string;
}

export interface GameStatePayload {
  game: GameState;
  clocks?: ClockSync;
  opponentName?: string | null;
  yourDisplayName?: string | null;
}
