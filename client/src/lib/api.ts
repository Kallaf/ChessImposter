import type { GameState } from '../types/game';
import { getGuestId } from './guest';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail ?? res.statusText;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export function getWsUrl(gameId: string): string {
  const base = API_URL.replace(/^http/, 'ws');
  const guestId = getGuestId();
  return `${base}/api/ws/games/${gameId}?guestId=${encodeURIComponent(guestId)}`;
}

export async function createGame(
  gameMode: 'standard' | 'true_king' = 'standard',
): Promise<GameState> {
  return request<GameState>('/api/games', {
    method: 'POST',
    body: JSON.stringify({ guestId: getGuestId(), gameMode }),
  });
}

export async function setTrueKing(
  gameId: string,
  square: string,
): Promise<GameState> {
  return request<GameState>(`/api/games/${gameId}/true-king`, {
    method: 'POST',
    body: JSON.stringify({ guestId: getGuestId(), square }),
  });
}

export async function joinGame(roomCode: string): Promise<GameState> {
  return request<GameState>('/api/games/join', {
    method: 'POST',
    body: JSON.stringify({ roomCode, guestId: getGuestId() }),
  });
}

export async function fetchGame(gameId: string): Promise<GameState> {
  const guestId = getGuestId();
  return request<GameState>(
    `/api/games/${gameId}?guestId=${encodeURIComponent(guestId)}`,
  );
}

export function getJoinLink(roomCode: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set('join', roomCode);
  return url.toString();
}
