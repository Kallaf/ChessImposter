import { useCallback, useEffect, useRef, useState } from 'react';
import { getDisplayName, getGuestId } from '../lib/guest';
import type { Challenge } from '../types/protocol';
import { wsBaseUrl } from '../lib/wsUrl';

const MAX_RECONNECT = 10000;

export function useLobbySocket(enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const onGameStartedRef = useRef<((gameId: string) => void) | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;
    const name = encodeURIComponent(getDisplayName() ?? 'Guest');
    const guestId = encodeURIComponent(getGuestId());
    const ws = new WebSocket(`${wsBaseUrl()}/api/ws/lobby?guestId=${guestId}&displayName=${name}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; payload?: unknown };
        const p = data.payload as Record<string, unknown>;
        switch (data.type) {
          case 'lobby:state':
            setChallenges((p.challenges as Challenge[]) ?? []);
            setOnlineCount((p.onlineCount as number) ?? 0);
            break;
          case 'lobby:challenge_created':
            setChallenges((prev) => [...prev, p as unknown as Challenge]);
            break;
          case 'lobby:challenge_removed':
            setChallenges((prev) =>
              prev.filter((c) => c.challengeId !== (p.challengeId as string)),
            );
            break;
          case 'lobby:presence':
            setOnlineCount((p.onlineCount as number) ?? 0);
            break;
          case 'lobby:game_started':
            onGameStartedRef.current?.((p.gameId as string) ?? '');
            break;
          case 'error':
            setError((p.message as string) ?? 'Lobby error');
            break;
          default:
            break;
        }
      } catch {
        setError('Invalid lobby message');
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, MAX_RECONNECT);
      reconnectAttempt.current += 1;
      window.setTimeout(() => {
        if (enabled) connect();
      }, delay);
    };

    ws.onerror = () => setError('Lobby connection error');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected to lobby');
      return;
    }
    ws.send(JSON.stringify({ type, payload }));
  }, []);

  const createChallenge = useCallback(
    (
      timeControl: string,
      sidePreference: string,
      gameMode: string = 'standard',
    ) => send('lobby:create_challenge', { timeControl, sidePreference, gameMode }),
    [send],
  );

  const joinChallenge = useCallback(
    (challengeId: string) => send('lobby:join_challenge', { challengeId }),
    [send],
  );

  const cancelChallenge = useCallback(
    (challengeId: string) => send('lobby:cancel_challenge', { challengeId }),
    [send],
  );

  const onGameStarted = useCallback((handler: (gameId: string) => void) => {
    onGameStartedRef.current = handler;
  }, []);

  return {
    connected,
    challenges,
    onlineCount,
    error,
    createChallenge,
    joinChallenge,
    cancelChallenge,
    onGameStarted,
  };
}
