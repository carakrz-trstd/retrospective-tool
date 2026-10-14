import { describe, expect, it } from 'vitest';
import scoringJson from '../../src/formats/data/scoring.json';
import { scoringConfigSchema, issuesToMessages } from '../../src/formats/schema';

function messages(raw: unknown): string[] {
  const r = scoringConfigSchema.safeParse(raw);
  return r.success ? [] : issuesToMessages(r.error);
}

describe('scoring config', () => {
  it('the shipped scoring.json is valid', () => {
    expect(scoringConfigSchema.safeParse(scoringJson).success).toBe(true);
  });

  it('rejects a negative multiplier with a message naming the field', () => {
    expect(messages({ ...scoringJson, goalMultiplier: -1 }).join(' ')).toMatch(/goalMultiplier/);
  });

  it('rejects a weak-match threshold above 1', () => {
    expect(messages({ ...scoringJson, weakThreshold: 1.5 }).join(' ')).toMatch(/weakThreshold/);
  });

  it('rejects more than 2 alternatives and a missing order', () => {
    expect(messages({ ...scoringJson, maxAlternatives: 3 }).join(' ')).toMatch(/maxAlternatives/);
    const noOrder: Record<string, unknown> = { ...scoringJson };
    delete noOrder.order;
    expect(messages(noOrder).join(' ')).toMatch(/order/);
  });
});
