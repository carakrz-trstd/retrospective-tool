import { useEffect, useState } from 'preact/hooks';

/** Re-renders the component every `ms` milliseconds (for clocks and timers). */
export function useTick(ms = 250): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
