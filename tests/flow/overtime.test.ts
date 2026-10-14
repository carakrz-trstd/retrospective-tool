import { describe, expect, it } from 'vitest';
import { timerDisplay } from '../../src/flow/display';
import { initialFlow } from '../../src/flow/flowState';
import { pause, reset, start, IDLE, used } from '../../src/flow/timer';
import type { FlowState, TimerState } from '../../src/flow/types';

const DURATION = 5 * 60_000;
const durationOf = () => DURATION;
const flowOf = (t: TimerState): FlowState => ({ ...initialFlow(), timers: { checkIn: t } });

describe('overtime (AC-11)', () => {
  it('after zero over is true and the overtime counts up', () => {
    const flow = flowOf(start(IDLE, DURATION, 0));
    const at = (ms: number) => timerDisplay(flow, durationOf, ms, 'online');
    expect(at(DURATION).over).toBe(false);
    expect(at(DURATION + 1_000)).toMatchObject({ over: true, overtimeText: '+0:01' });
    expect(at(DURATION + 2_000)).toMatchObject({ over: true, overtimeText: '+0:02' });
    expect(at(DURATION + 2_000).text).toBe('0:00');
  });

  it('resetting the timer clears it', () => {
    const d = timerDisplay(flowOf(reset()), durationOf, 10 * DURATION, 'online');
    expect(d.over).toBe(false);
    expect(d.overtimeText).toBeUndefined();
    expect(d.text).toBe('5:00');
  });

  it('moving away from the stop pauses it and keeps the overtime as used time', () => {
    const paused = pause(start(IDLE, DURATION, 0), DURATION, DURATION + 10_000);
    expect(used(paused, DURATION, 999_999_999)).toBe(DURATION + 10_000);
    const d = timerDisplay(flowOf(paused), durationOf, 999_999_999, 'online');
    expect(d).toMatchObject({ over: true, overtimeText: '+0:10', status: 'paused' });
  });
});
