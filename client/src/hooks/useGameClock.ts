import { useEffect, useRef, useState } from 'react';
import type { ClockSync } from '../types/protocol';

const DRIFT_THRESHOLD_MS = 500;

function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useGameClock(
  clocks: ClockSync | null | undefined,
  gameActive: boolean,
) {
  const [display, setDisplay] = useState({ white: '0:00', black: '0:00' });
  const syncRef = useRef<ClockSync | null>(null);
  const localAnchorRef = useRef<number>(0);

  useEffect(() => {
    if (!clocks) return;
    const localNow = Date.now();
    const serverNow = clocks.serverNowMs;
    const drift = Math.abs(localNow - serverNow);
    syncRef.current = clocks;
    localAnchorRef.current = drift > DRIFT_THRESHOLD_MS ? serverNow : localNow;
  }, [clocks]);

  useEffect(() => {
    if (!gameActive || !syncRef.current) return;

    const tick = () => {
      const sync = syncRef.current;
      if (!sync) return;
      const elapsed = Date.now() - localAnchorRef.current;
      let white = sync.whiteMs;
      let black = sync.blackMs;
      if (sync.activeColor === 'white') white = Math.max(0, white - elapsed);
      if (sync.activeColor === 'black') black = Math.max(0, black - elapsed);
      setDisplay({ white: formatMs(white), black: formatMs(black) });
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [gameActive, clocks]);

  return display;
}
