import { afterEach, describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { makeState } from '../contrib/stateBuilder';

const original = process.env.TZ;
afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

describe('the date of the documentation', () => {
  // 2026-03-01 23:30 in UTC
  const createdAt = Date.UTC(2026, 2, 1, 23, 30, 0);

  it.each([
    ['America/Los_Angeles', '2026-03-01'],
    ['UTC', '2026-03-01'],
    ['Asia/Tokyo', '2026-03-02'],
  ])('is the local date of createdAt in %s', (zone, expected) => {
    process.env.TZ = zone;
    const model = buildDocumentModel(makeState({ createdAt, status: 'ended' }), { incomplete: false });
    expect(model.date).toBe(expected);
    expect(model.heading).toContain(expected);
  });
});
