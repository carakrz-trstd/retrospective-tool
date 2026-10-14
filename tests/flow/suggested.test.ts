import { describe, expect, it } from 'vitest';
import { suggestedMs, plannedTotalMs } from '../../src/flow/suggested';
import { STOPS } from '../../src/flow/stops';
import { createCustomFromScratch } from '../../src/formats/custom';
import { defaults } from '../../src/formats/defaults';
import { TIME_BUDGETS } from '../../src/formats/types';
import { sampleFormat } from '../formats/sample';

const MIN = 60_000;

describe('suggested times', () => {
  it('take the 50-minute split of the format for the eight stops and add up to 50 minutes', () => {
    const f = sampleFormat();
    const values = STOPS.map((s) => suggestedMs(s, f, 50) / MIN);
    expect(values).toEqual([5, 5, 8, 5, 14, 3, 6, 4]);
    expect(plannedTotalMs(f, 50)).toBe(50 * MIN);
  });

  it('a custom format uses the generic default split for 30, 50 and 80 minutes', () => {
    const custom = createCustomFromScratch();
    for (const budget of TIME_BUDGETS) {
      expect(plannedTotalMs(custom, budget)).toBe(budget * MIN);
      expect(suggestedMs('checkIn', custom, budget)).toBe(
        defaults.timeSplits[String(budget) as '30'].checkIn * MIN,
      );
    }
  });

  it('a format without a split for the budget falls back to the default shares, rounded to whole minutes', () => {
    const only30 = sampleFormat({ timeSplits: { '30': sampleFormat().timeSplits['30']! } });
    const values = STOPS.map((s) => suggestedMs(s, only30, 80) / MIN);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
    const total = values.reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 80)).toBeLessThanOrEqual(1);
  });
});
