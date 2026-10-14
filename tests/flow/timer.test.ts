import { describe, expect, it } from 'vitest';
import { IDLE, pause, remaining, reset, start, timerView, used, type TimerState } from '../../src/flow/timer';

const FIVE_MIN = 5 * 60 * 1000;

describe('timer', () => {
  it('an idle timer has the full duration remaining', () => {
    expect(remaining(IDLE, FIVE_MIN, 123_456)).toBe(FIVE_MIN);
  });

  it('start at host time 1000 gives 5:00 at 1000, 4:59 at 2000, 0:00 at 301000 and -0:10 at 311000', () => {
    const t = start(IDLE, FIVE_MIN, 1_000);
    expect(t.status).toBe('running');
    expect(remaining(t, FIVE_MIN, 1_000)).toBe(300_000);
    expect(remaining(t, FIVE_MIN, 2_000)).toBe(299_000);
    expect(remaining(t, FIVE_MIN, 301_000)).toBe(0);
    expect(remaining(t, FIVE_MIN, 311_000)).toBe(-10_000); // overtime
  });

  it('pause at 61000 stores remainingMs = 240000 and the remaining time no longer changes', () => {
    const running = start(IDLE, FIVE_MIN, 1_000);
    const paused = pause(running, FIVE_MIN, 61_000);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(240_000);
    expect(remaining(paused, FIVE_MIN, 61_000)).toBe(240_000);
    expect(remaining(paused, FIVE_MIN, 999_999)).toBe(240_000);
  });

  it('start after pause continues from the stored remaining time', () => {
    const paused = pause(start(IDLE, FIVE_MIN, 1_000), FIVE_MIN, 61_000);
    const again = start(paused, FIVE_MIN, 100_000);
    expect(again.status).toBe('running');
    expect(remaining(again, FIVE_MIN, 100_000)).toBe(240_000);
    expect(remaining(again, FIVE_MIN, 130_000)).toBe(210_000);
  });

  it('reset returns to idle with the full duration', () => {
    const paused = pause(start(IDLE, FIVE_MIN, 0), FIVE_MIN, 50_000);
    const r = reset();
    expect(r).toEqual({ status: 'idle' });
    expect(remaining(r, FIVE_MIN, 70_000)).toBe(FIVE_MIN);
    expect(paused.remainingMs).toBe(250_000);
  });

  it('start on a running timer and pause on a non-running timer change nothing', () => {
    const running = start(IDLE, FIVE_MIN, 1_000);
    expect(start(running, FIVE_MIN, 9_000)).toEqual(running);
    expect(pause(IDLE, FIVE_MIN, 9_000)).toEqual(IDLE);
    const paused = pause(running, FIVE_MIN, 5_000);
    expect(pause(paused, FIVE_MIN, 9_000)).toEqual(paused);
  });

  it('pausing in overtime keeps the negative remaining time', () => {
    const paused = pause(start(IDLE, FIVE_MIN, 0), FIVE_MIN, 310_000);
    expect(paused.remainingMs).toBe(-10_000);
    expect(remaining(paused, FIVE_MIN, 400_000)).toBe(-10_000);
  });

  it('used is duration minus remaining, never negative, and counts overtime', () => {
    expect(used(IDLE, FIVE_MIN, 0)).toBe(0);
    const running = start(IDLE, FIVE_MIN, 0);
    expect(used(running, FIVE_MIN, 60_000)).toBe(60_000);
    expect(used(running, FIVE_MIN, 310_000)).toBe(310_000); // 5:10
    // a paused timer with more remaining than the duration (cannot happen) still gives 0
    const odd: TimerState = { status: 'paused', remainingMs: FIVE_MIN + 1000 };
    expect(used(odd, FIVE_MIN, 0)).toBe(0);
  });

  it('timerView gives the display model: mm:ss, over and overtime counting up', () => {
    const running = start(IDLE, FIVE_MIN, 0);
    expect(timerView(running, FIVE_MIN, 1_000)).toMatchObject({
      status: 'running',
      over: false,
      text: '4:59',
    });
    expect(timerView(running, FIVE_MIN, 300_000)).toMatchObject({ over: false, text: '0:00' });
    expect(timerView(running, FIVE_MIN, 301_000)).toMatchObject({
      over: true,
      overtimeText: '+0:01',
      text: '0:00',
    });
    expect(timerView(running, FIVE_MIN, 435_000)).toMatchObject({ over: true, overtimeText: '+2:15' });
    expect(timerView(IDLE, FIVE_MIN, 0)).toMatchObject({ status: 'idle', text: '5:00', over: false });
  });
});
