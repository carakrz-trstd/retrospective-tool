import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialFlow } from '../../src/flow/flowState';
import { TimerWatcher } from '../../src/flow/watcher';
import type { FlowState, TimerState } from '../../src/flow/types';

const DURATION = 5 * 60_000;

function flowWith(timer: TimerState): FlowState {
  return { ...initialFlow(), timers: { checkIn: timer } };
}
const running = (startedAt: number, remainingMs = DURATION): TimerState => ({
  status: 'running',
  startedAt,
  remainingMs,
});

let fired: Array<[string, number]>;
let watcher: TimerWatcher;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  fired = [];
  watcher = new TimerWatcher({
    hostNow: () => Date.now(),
    durationOf: () => DURATION,
    onOver: (stop, startedAt) => fired.push([stop, startedAt]),
  });
});
afterEach(() => {
  watcher.dispose();
  vi.useRealTimers();
});

describe('TimerWatcher', () => {
  it('fires exactly once when a running timer reaches zero', () => {
    watcher.update(flowWith(running(Date.now())));
    vi.advanceTimersByTime(DURATION - 1);
    expect(fired).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([['checkIn', 1_000_000]]);
    vi.advanceTimersByTime(10 * 60_000);
    watcher.update(flowWith(running(1_000_000))); // a re-render with the same state
    vi.advanceTimersByTime(60_000);
    expect(fired).toHaveLength(1);
  });

  it('pausing or resetting before zero cancels it', () => {
    watcher.update(flowWith(running(Date.now())));
    vi.advanceTimersByTime(60_000);
    watcher.update(flowWith({ status: 'paused', remainingMs: DURATION - 60_000 }));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(0);

    watcher.update(flowWith(running(Date.now(), DURATION)));
    vi.advanceTimersByTime(1_000);
    watcher.update(flowWith({ status: 'idle' }));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(0);
  });

  it('a timer that is already over when the device joins does not fire', () => {
    const startedAt = Date.now() - DURATION - 30_000;
    watcher.update(flowWith(running(startedAt)));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(0);
    // and a reconnect (snapshot with the same timer) stays silent too
    watcher.update(flowWith(running(startedAt)));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(0);
  });

  it('a restarted timer (new startedAt) can fire again', () => {
    watcher.update(flowWith(running(Date.now())));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(1);
    watcher.update(flowWith({ status: 'idle' }));
    watcher.update(flowWith(running(Date.now())));
    vi.advanceTimersByTime(DURATION);
    expect(fired).toHaveLength(2);
    expect(fired[1]![1]).toBe(fired[0]![1] + DURATION);
  });

  it('only watches the timer of the current stop', () => {
    const flow: FlowState = { ...initialFlow(), stop: 'notes', timers: { checkIn: running(Date.now()) } };
    watcher.update(flow);
    vi.advanceTimersByTime(DURATION * 2);
    expect(fired).toHaveLength(0);
  });
});
