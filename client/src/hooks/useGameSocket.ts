import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGame } from '../lib/api';
import { getGuestId } from '../lib/guest';
import { wsBaseUrl } from '../lib/wsUrl';
import type { GameState } from '../types/game';
import type { ClockSync, GameStatePayload } from '../types/protocol';

const MAX_RECONNECT_DELAY = 10000;

export function useGameSocket(gameId: string | undefined) {
  const [game, setGame] = useState<GameState | null>(null);
  const [clocks, setClocks] = useState<ClockSync | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});

  const applyPayload = useCallback((payload: GameStatePayload) => {
    setGame(payload.game);
    if (payload.clocks) setClocks(payload.clocks);
  }, []);

  const resync = useCallback(async () => {
    if (!gameId) return;
    try {
      const snapshot = await fetchGame(gameId);
      if (mountedRef.current) {
        setGame(snapshot);
        if (snapshot.clocks) setClocks(snapshot.clocks);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load game');
      }
    }
  }, [gameId]);

  const connect = useCallback(() => {
    if (!gameId) return;

    const guestId = encodeURIComponent(getGuestId());
    const ws = new WebSocket(`${wsBaseUrl()}/api/ws/games/${gameId}?guestId=${guestId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setError(null);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          payload?: unknown;
          game?: GameState;
          message?: string;
        };

        if (data.type === 'game:state' && data.payload) {
          applyPayload(data.payload as GameStatePayload);
        } else if (data.type === 'game:time_sync' && data.payload) {
          setClocks(data.payload as ClockSync);
        } else if (data.type === 'game:timeout' && data.payload) {
          const p = data.payload as { winner?: string };
          void resync();
          setError(`Time out — ${p.winner === 'white' ? 'White' : 'Black'} wins`);
        } else if (data.type === 'game_state' && data.game) {
          setGame(data.game);
        } else if (data.type === 'error') {
          const p = data.payload as { message?: string };
          setError(p?.message ?? data.message ?? 'Error');
        }
      } catch {
        setError('Invalid server message');
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(
        1000 * 2 ** reconnectAttempt.current,
        MAX_RECONNECT_DELAY,
      );
      reconnectAttempt.current += 1;
      window.setTimeout(() => {
        if (mountedRef.current && gameId) connectRef.current();
      }, delay);
    };

    ws.onerror = () => {
      if (mountedRef.current) setError('Connection error');
    };
  }, [gameId, applyPayload, resync]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    if (!gameId) return;

    queueMicrotask(() => void resync());
    connect();

    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [gameId, connect, resync]);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    ws.send(JSON.stringify({ type, payload }));
  }, []);

  const sendMove = useCallback(
    (uci: string) => send('game:move', { uci }),
    [send],
  );

  const sendTrueKing = useCallback(
    (square: string) => send('set_true_king', { square }),
    [send],
  );

  const sendConfirmTrueKing = useCallback(
    () => send('confirm_true_king', {}),
    [send],
  );

  const abort = useCallback(
    () => send('abort', {}),
    [send],
  );

  
  const resign = useCallback(
    () => send('resign', {}),
    [send],
  );

  return {
    game,
    clocks,
    connected,
    error,
    sendMove,
    sendTrueKing,
    sendConfirmTrueKing,
    abort,
    resign,
    resync,
  };
}
