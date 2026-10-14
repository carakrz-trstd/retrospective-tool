import { describe, expect, it } from 'vitest';
import { getFormat, listFormats, supports } from '../../src/formats/library';
import scoringJson from '../../src/formats/data/scoring.json';
import { validateFormat } from '../../src/formats/validate';
import { TIME_BUDGETS } from '../../src/formats/types';

const NAMES = [
  'Start-Stop-Continue',
  'Mad-Sad-Glad',
  '4Ls',
  'Sailboat',
  'Starfish',
  'Plus/Delta',
  'Rose-Thorn-Bud',
  'Timeline',
  'Three Little Pigs',
  'Hot Air Balloon',
  'Kudos Cards',
  'Speed Car',
];

describe('the format library', () => {
  const formats = listFormats();

  it('contains exactly the 12 formats of the PRD', () => {
    expect(formats.map((f) => f.name).sort()).toEqual([...NAMES].sort());
  });

  it('every format passes validateFormat', () => {
    for (const f of formats) {
      const r = validateFormat(f);
      expect(r.ok, `${f.id}: ${r.ok ? '' : r.errors.join('; ')}`).toBe(true);
    }
  });

  it('every time budget (30, 50, 80) has at least 3 formats', () => {
    for (const budget of TIME_BUDGETS) {
      expect(formats.filter((f) => supports(f, budget)).length, `${budget} min`).toBeGreaterThanOrEqual(3);
    }
  });

  it('Starfish has 5 columns', () => {
    expect(getFormat('starfish')!.columns).toHaveLength(5);
  });

  it('IDs are unique and the tie-break order lists exactly the loaded IDs', () => {
    const ids = formats.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...scoringJson.order].sort()).toEqual([...ids].sort());
  });

  it('only the five formats confirmed on funretrospectives.com carry that source; the others have none', () => {
    const confirmed = ['starfish', '4ls', 'three-little-pigs', 'hot-air-balloon', 'speed-car'];
    for (const f of formats) {
      if (confirmed.includes(f.id)) {
        expect(f.source?.name, f.id).toBe('funretrospectives.com');
        expect(f.source?.url, f.id).toMatch(/^https:\/\/(www\.)?funretrospectives\.com\/.+/);
      } else {
        expect(f.source, f.id).toBeUndefined();
      }
    }
  });

  it('every column has a prompt that helps a first-time facilitator', () => {
    for (const f of formats)
      for (const c of f.columns) expect((c.prompt ?? '').length, `${f.id}/${c.id}`).toBeGreaterThan(5);
  });

  it('formats are returned in the tie-break order', () => {
    expect(formats.map((f) => f.id)).toEqual(scoringJson.order);
  });

  it('getFormat returns undefined for an unknown ID', () => {
    expect(getFormat('nope')).toBeUndefined();
  });
});
