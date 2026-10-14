import { describe, expect, it } from 'vitest';
import { defaults } from '../../src/formats/defaults';
import { defaultsSchema, splitTotal } from '../../src/formats/schema';
import { validateFormat } from '../../src/formats/validate';
import { sampleFormat } from './sample';

describe('generic defaults', () => {
  it('the three generic default splits sum to 30, 50 and 80', () => {
    expect(splitTotal(defaults.timeSplits['30'])).toBe(30);
    expect(splitTotal(defaults.timeSplits['50'])).toBe(50);
    expect(splitTotal(defaults.timeSplits['80'])).toBe(80);
  });

  it('a format built from the generic splits passes the time split rule', () => {
    const f = sampleFormat({ timeSplits: defaults.timeSplits });
    expect(validateFormat(f).ok).toBe(true);
  });

  it('the generic check-in list has at least 5 non-empty, unique questions', () => {
    expect(defaults.checkInQuestions.length).toBeGreaterThanOrEqual(5);
    for (const q of defaults.checkInQuestions) expect(q.trim().length).toBeGreaterThan(0);
    expect(new Set(defaults.checkInQuestions).size).toBe(defaults.checkInQuestions.length);
  });

  it('the schema rejects a split that does not add up and a duplicate question', () => {
    const bad = structuredClone(defaults);
    bad.timeSplits['30'].notes += 1;
    expect(defaultsSchema.safeParse(bad).success).toBe(false);
    const dup = structuredClone(defaults);
    dup.checkInQuestions[1] = dup.checkInQuestions[0]!;
    expect(defaultsSchema.safeParse(dup).success).toBe(false);
  });
});
