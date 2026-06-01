import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGame, getWsUrl } from '../lib/api';
import type { GameState, WsMessage } from '../types/game';

const MAX_RECONNECT_DELAY = 10000;

export function useGameSocket(gameId: string | undefined) {
  const [game, setGame] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});

  const resync = useCallback(async () => {
    if (!gameId) return;
    try {
      const snapshot = await fetchGame(gameId);
      if (mountedRef.current) setGame(snapshot);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load game');
      }
    }
  }, [gameId]);

  const connect = useCallback(() => {
    if (!gameId) return;

    const ws = new WebSocket(getWsUrl(gameId));
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
        const data = JSON.parse(event.data) as WsMessage;
        if (data.type === 'game_state' && data.game) {
          setGame(data.game);
        } else if (data.type === 'error' && data.message) {
          setError(data.message);
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
  }, [gameId]);
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

  const sendMove = useCallback((uci: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    ws.send(JSON.stringify({ type: 'move', uci }));
  }, []);

  const sendTrueKing = useCallback((square: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    ws.send(JSON.stringify({ type: 'set_true_king', square }));
  }, []);

  const sendConfirmTrueKing = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    ws.send(JSON.stringify({ type: 'confirm_true_king' }));
  }, []);

  return {
    game,
    connected,
    error,
    sendMove,
    sendTrueKing,
    sendConfirmTrueKing,
    resync,
  };
}
