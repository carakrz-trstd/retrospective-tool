// Pure timer maths. All times are host times in ms; remaining time is negative in overtime.
import type { TimerState } from './types';

export type { TimerState };

export const IDLE: TimerState = { status: 'idle' };

export function reset(): TimerState {
  return { status: 'idle' };
}

/** Remaining ms at host time `now` (negative = overtime). */
export function remaining(t: TimerState, durationMs: number, now: number): number {
  if (t.status === 'idle') return durationMs;
  if (t.status === 'paused') return t.remainingMs ?? durationMs;
  return (t.remainingMs ?? durationMs) - (now - (t.startedAt ?? now));
}

export function start(t: TimerState, durationMs: number, now: number): TimerState {
  if (t.status === 'running') return t;
  const base = t.status === 'paused' ? (t.remainingMs ?? durationMs) : durationMs;
  return { status: 'running', startedAt: now, remainingMs: base };
}

export function pause(t: TimerState, durationMs: number, now: number): TimerState {
  if (t.status !== 'running') return t;
  return { status: 'paused', remainingMs: remaining(t, durationMs, now) };
}

/** Time used so far (never negative, includes overtime). */
export function used(t: TimerState, durationMs: number, now: number): number {
  return Math.max(0, durationMs - remaining(t, durationMs, now));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  return `${Math.floor(total / 60)}:${String(s).padStart(2, '0')}`;
}

/** Overtime as shown on screen: "+02:15". */
export function formatOvertime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `+${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export interface TimerViewModel {
  status: TimerState['status'];
  remainingMs: number;
  over: boolean;
  /** mm:ss of the time left (0:00 once it is over). */
  text: string;
  /** "+m:ss" once the time is over. */
  overtimeText?: string;
  /** How far past zero the timer is, in ms (only once over). */
  overtimeMs?: number;
}

export function timerView(t: TimerState, durationMs: number, now: number): TimerViewModel {
  const rem = remaining(t, durationMs, now);
  if (rem < 0) {
    return {
      status: t.status,
      remainingMs: rem,
      over: true,
      text: '0:00',
      overtimeText: `+${formatClock(-rem)}`,
      overtimeMs: -rem,
    };
  }
  return { status: t.status, remainingMs: rem, over: false, text: formatClock(Math.ceil(rem / 1000) * 1000) };
}
