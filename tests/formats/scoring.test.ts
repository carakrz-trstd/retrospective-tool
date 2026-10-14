import { describe, expect, it } from 'vitest';
import { scoringConfig } from '../../src/formats/defaults';
import { listFormats, supports } from '../../src/formats/library';
import { recommend } from '../../src/formats/scoring';
import { DEPTHS, GOALS, MOODS, SETTINGS, TIME_BUDGETS, type Answers } from '../../src/formats/types';
import type { Format } from '../../src/formats/types';
import { sampleFormat } from './sample';

const formats = listFormats();

const calm: Answers = {
  mood: 'tired',
  goal: 'reflect-period',
  timeBudgetMin: 30,
  depth: 'lean',
  setting: 'remote',
};
const lively: Answers = {
  mood: 'energized',
  goal: 'bond',
  timeBudgetMin: 80,
  depth: 'extensive',
  setting: 'in-room',
};

/** A synthetic format with the same weight everywhere unless overridden. */
function synthetic(
  id: string,
  w: number,
  over: Partial<Format['fit']> = {},
  budgets: (30 | 50 | 80)[] = [30, 50, 80],
): Format {
  const base = sampleFormat();
  const timeSplits = Object.fromEntries(budgets.map((b) => [String(b), base.timeSplits[String(b) as '30']!]));
  return sampleFormat({
    id,
    name: id,
    timeSplits,
    fit: {
      mood: { energized: w, neutral: w, tired: w, tense: w },
      goal: { fun: w, bond: w, 'reflect-period': w, 'reflect-project': w },
      depth: { lean: w, extensive: w },
      setting: { 'in-room': w, remote: w },
      ...over,
    },
  });
}

describe('recommend with the real library', () => {
  it('two clearly different answer sets lead to different recommended formats, each fitting its time', () => {
    const a = recommend(calm, formats, scoringConfig);
    const b = recommend(lively, formats, scoringConfig);
    expect(a.recommended.format.id).not.toBe(b.recommended.format.id);
    expect(supports(a.recommended.format, 30)).toBe(true);
    expect(supports(b.recommended.format, 80)).toBe(true);
  });

  it('for every combination of answers there is one recommended format and 1-2 distinct alternatives that all support the time', () => {
    let combos = 0;
    for (const mood of MOODS)
      for (const goal of GOALS)
        for (const timeBudgetMin of TIME_BUDGETS)
          for (const depth of DEPTHS)
            for (const setting of SETTINGS) {
              combos++;
              const rec = recommend({ mood, goal, timeBudgetMin, depth, setting }, formats, scoringConfig);
              const all = [rec.recommended, ...rec.alternatives];
              expect(rec.alternatives.length).toBeGreaterThanOrEqual(1);
              expect(rec.alternatives.length).toBeLessThanOrEqual(2);
              expect(new Set(all.map((m) => m.format.id)).size).toBe(all.length);
              for (const m of all) expect(supports(m.format, timeBudgetMin)).toBe(true);
              for (const m of all) {
                expect(m.reasons.length).toBeGreaterThanOrEqual(1);
                expect(m.reasons.length).toBeLessThanOrEqual(2);
                for (const r of m.reasons) expect(r.trim().length).toBeGreaterThan(3);
              }
              // sorted by score, best first
              for (let i = 1; i < all.length; i++)
                expect(all[i - 1]!.score).toBeGreaterThanOrEqual(all[i]!.score);
            }
    expect(combos).toBe(192);
  });

  it('is deterministic across repeated calls', () => {
    const first = recommend(calm, formats, scoringConfig);
    for (let i = 0; i < 5; i++) {
      const again = recommend(calm, formats, scoringConfig);
      expect(again.recommended.format.id).toBe(first.recommended.format.id);
      expect(again.alternatives.map((m) => m.format.id)).toEqual(first.alternatives.map((m) => m.format.id));
    }
  });

  it('a normal answer set is not a weak match', () => {
    expect(recommend(calm, formats, scoringConfig).weak).toBe(false);
    expect(recommend(lively, formats, scoringConfig).weak).toBe(false);
  });

  it('reasons mention the answers they come from when no own text exists', () => {
    const rec = recommend(calm, [synthetic('a', 3), synthetic('b', 2), synthetic('c', 1)], scoringConfig);
    const text = rec.recommended.reasons.join(' ').toLowerCase();
    expect(text).toMatch(/tired|period|lean|remote/);
  });

  it("uses the format's own reason texts when it has them", () => {
    const own = sampleFormat({
      id: 'own',
      reasons: { mood: { tired: 'My own tired text.' }, goal: { 'reflect-period': 'My own period text.' } },
      fit: {
        mood: { energized: 0, neutral: 0, tired: 3, tense: 0 },
        goal: { fun: 0, bond: 0, 'reflect-period': 3, 'reflect-project': 0 },
        depth: { lean: 0, extensive: 0 },
        setting: { 'in-room': 0, remote: 0 },
      },
    });
    const rec = recommend(calm, [own, synthetic('b', 1), synthetic('c', 1)], scoringConfig);
    expect(rec.recommended.format.id).toBe('own');
    expect(rec.recommended.reasons).toEqual(['My own period text.', 'My own tired text.']);
  });
});

describe('recommend with synthetic libraries', () => {
  const config = { ...scoringConfig, order: ['first', 'second', 'third'] };

  it('with identical weights the configured tie-break order decides', () => {
    const lib = [synthetic('third', 2), synthetic('first', 2), synthetic('second', 2)];
    const rec = recommend(calm, lib, config);
    expect([rec.recommended.format.id, ...rec.alternatives.map((m) => m.format.id)]).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('formats that are not in the tie-break order come last, by ID', () => {
    const lib = [synthetic('zeta', 2), synthetic('alpha', 2), synthetic('second', 2)];
    const rec = recommend(calm, lib, config);
    expect([rec.recommended.format.id, ...rec.alternatives.map((m) => m.format.id)]).toEqual([
      'second',
      'alpha',
      'zeta',
    ]);
  });

  it('when every weight is 0 the best match is still returned, flagged weak', () => {
    const rec = recommend(calm, [synthetic('a', 0), synthetic('b', 0), synthetic('c', 0)], config);
    expect(rec.recommended).toBeDefined();
    expect(rec.recommended.weak).toBe(true);
    expect(rec.weak).toBe(true);
    expect(rec.alternatives.every((m) => m.weak)).toBe(true);
    expect(rec.recommended.reasons.length).toBeGreaterThanOrEqual(1); // even a weak match explains itself
  });

  it('a good match is not weak and a score just below the threshold is', () => {
    const max = 3 * (1 + config.goalMultiplier + 1 + 1);
    const good = recommend(calm, [synthetic('a', 3)], config);
    expect(good.recommended.score).toBe(max);
    expect(good.weak).toBe(false);
    // all weights 1: score 1 + 2 + 1 + 1 = 5 of 15 -> weak
    expect(recommend(calm, [synthetic('b', 1)], config).weak).toBe(true);
    // all weights 2 -> 10 of 15 -> not weak
    expect(recommend(calm, [synthetic('c', 2)], config).weak).toBe(false);
  });

  it('the goal answer counts with the configured multiplier', () => {
    const goalHeavy = synthetic('goal-heavy', 0, {
      goal: { fun: 0, bond: 0, 'reflect-period': 3, 'reflect-project': 0 },
    });
    const rest = synthetic('rest', 0, {
      mood: { energized: 0, neutral: 0, tired: 3, tense: 0 },
      depth: { lean: 3, extensive: 0 },
      setting: { 'in-room': 0, remote: 0 },
    });
    // goal 3 * 2 = 6 versus mood 3 + depth 3 = 6 with multiplier 2: tie -> order decides; make the order favour "rest"
    const withTwo = recommend(calm, [goalHeavy, rest], {
      ...config,
      goalMultiplier: 2,
      order: ['rest', 'goal-heavy'],
    });
    expect(withTwo.recommended.score).toBe(6);
    const withThree = recommend(calm, [goalHeavy, rest], {
      ...config,
      goalMultiplier: 3,
      order: ['rest', 'goal-heavy'],
    });
    expect(withThree.recommended.format.id).toBe('goal-heavy');
    expect(withThree.recommended.score).toBe(9);
    const withZero = recommend(calm, [goalHeavy, rest], {
      ...config,
      goalMultiplier: 0,
      order: ['goal-heavy', 'rest'],
    });
    expect(withZero.recommended.format.id).toBe('rest');
  });

  it('never recommends a format that cannot fit the time budget (hard filter)', () => {
    const short = synthetic('short-only', 3, {}, [30]);
    const long = synthetic('long-only', 0, {}, [80]);
    const mid = synthetic('both', 1, {}, [30, 80]);
    const rec = recommend({ ...calm, timeBudgetMin: 80 }, [short, long, mid], { ...config, order: [] });
    const ids = [rec.recommended.format.id, ...rec.alternatives.map((m) => m.format.id)];
    expect(ids).toEqual(['both', 'long-only']);
    expect(ids).not.toContain('short-only');
  });

  it('with a single candidate there are no alternatives; with none it throws', () => {
    expect(recommend(calm, [synthetic('a', 2)], config).alternatives).toEqual([]);
    expect(() => recommend({ ...calm, timeBudgetMin: 50 }, [synthetic('a', 2, {}, [30])], config)).toThrow(
      /time/i,
    );
  });

  it('returns at most maxAlternatives alternatives', () => {
    const lib = ['a', 'b', 'c', 'd', 'e'].map((id) => synthetic(id, 2));
    expect(recommend(calm, lib, { ...config, maxAlternatives: 1 }).alternatives).toHaveLength(1);
    expect(recommend(calm, lib, { ...config, maxAlternatives: 2 }).alternatives).toHaveLength(2);
  });
});
