import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostClock } from '../../src/flow/clock';
import { timerDisplay } from '../../src/flow/display';
import { initialFlow } from '../../src/flow/flowState';
import type { FlowState } from '../../src/flow/types';

const DURATION = 5 * 60_000;
const durationOf = () => DURATION;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(2_000_000);
});
afterEach(() => vi.useRealTimers());

function runningFlow(startedAt: number): FlowState {
  return { ...initialFlow(), timers: { checkIn: { status: 'running', startedAt, remainingMs: DURATION } } };
}

describe('timer display while the Facilitator is offline (AC-16, AC-20)', () => {
  it('is marked not synchronized and keeps counting from the last known estimate', () => {
    const clock = new HostClock();
    clock.observe(Date.now(), Date.now());
    const flow = runningFlow(Date.now());
    const a = timerDisplay(flow, durationOf, clock.hostNow(), 'facilitator-offline');
    vi.advanceTimersByTime(10_000);
    const b = timerDisplay(flow, durationOf, clock.hostNow(), 'facilitator-offline');
    expect(a.notSynchronized).toBe(true);
    expect(b.notSynchronized).toBe(true);
    expect(a.remainingMs - b.remainingMs).toBe(10_000);
  });

  it('is corrected and the mark disappears when the Facilitator returns and a snapshot arrives', () => {
    const clock = new HostClock();
    clock.observe(Date.now(), Date.now());
    const startedAt = Date.now();
    vi.advanceTimersByTime(10_000);
    // the host had paused the timer 4 s after the start while we were offline
    const hostFlow: FlowState = {
      ...initialFlow(),
      timers: { checkIn: { status: 'paused', remainingMs: DURATION - 4_000 } },
    };
    clock.observe(Date.now(), Date.now());
    const after = timerDisplay(hostFlow, durationOf, clock.hostNow(), 'online');
    expect(after.notSynchronized).toBe(false);
    expect(after.remainingMs).toBe(DURATION - 4_000);
    expect(startedAt).toBeLessThan(Date.now());
  });

  it('a paused timer stays unchanged while offline', () => {
    const clock = new HostClock();
    const flow: FlowState = {
      ...initialFlow(),
      timers: { checkIn: { status: 'paused', remainingMs: 120_000 } },
    };
    const a = timerDisplay(flow, durationOf, clock.hostNow(), 'facilitator-offline');
    vi.advanceTimersByTime(30_000);
    const b = timerDisplay(flow, durationOf, clock.hostNow(), 'facilitator-offline');
    expect(b.remainingMs).toBe(a.remainingMs);
    expect(b.text).toBe('2:00');
  });
});
