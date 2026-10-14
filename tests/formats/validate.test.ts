import { describe, expect, it } from 'vitest';
import { validateCustomFormat, validateFormat } from '../../src/formats/validate';
import type { Format } from '../../src/formats/types';
import { sampleFormat } from './sample';

function errorsOf(input: unknown): string[] {
  const r = validateFormat(input);
  return r.ok ? [] : r.errors;
}

function mutate(fn: (f: any) => void): unknown {
  const f: any = sampleFormat();
  fn(f);
  return f;
}

describe('validateFormat', () => {
  it('accepts a valid sample format', () => {
    const r = validateFormat(sampleFormat());
    expect(r.ok).toBe(true);
  });

  it.each([
    ['missing name', (f: any) => delete f.name, 'name'],
    ['empty name', (f: any) => (f.name = '  '), 'name'],
    ['missing description', (f: any) => delete f.description, 'description'],
    ['1 column', (f: any) => (f.columns = [f.columns[0]]), 'columns'],
    [
      '6 columns',
      (f: any) => (f.columns = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id.toUpperCase() }))),
      'columns',
    ],
    ['duplicate column IDs', (f: any) => (f.columns[1].id = f.columns[0].id), 'columns'],
    ['empty column name', (f: any) => (f.columns[1].name = ''), 'columns.1.name'],
    ['no supported duration', (f: any) => (f.timeSplits = {}), 'timeSplits'],
    [
      'a time split that sums to 29 instead of 30',
      (f: any) => (f.timeSplits['30'].notes = 1),
      'timeSplits.30',
    ],
    ['a negative minute', (f: any) => (f.timeSplits['50'].checkIn = -5), 'timeSplits.50'],
    ['a fractional minute', (f: any) => (f.timeSplits['50'].notes = 3.5), 'timeSplits.50'],
    ['a missing weight for an answer option', (f: any) => delete f.fit.mood.tired, 'fit.mood'],
    ['a weight of 4', (f: any) => (f.fit.goal.fun = 4), 'fit.goal.fun'],
    ['only 1 facilitation tip', (f: any) => (f.facilitationTips = ['One.']), 'facilitationTips'],
    ['an empty check-in question', (f: any) => (f.checkInQuestion = ''), 'checkInQuestion'],
    ['an invalid ID', (f: any) => (f.id = 'Not Valid!'), 'id'],
  ])('rejects %s with a message naming the field', (_label, change, field) => {
    const errors = errorsOf(mutate(change));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.startsWith(field) || e.includes(`${field}`))).toBe(true);
  });

  it('accepts a library format with 5 columns', () => {
    const f = sampleFormat({
      columns: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() })),
    });
    expect(validateFormat(f).ok).toBe(true);
  });

  it('rejects things that are not objects', () => {
    expect(validateFormat(null).ok).toBe(false);
    expect(validateFormat('x').ok).toBe(false);
  });
});

describe('validateCustomFormat', () => {
  function custom(
    columns: { id: string; name: string; prompt?: string }[],
    extra: Partial<Format> = {},
  ): Format {
    return sampleFormat({ id: 'custom-abc', custom: true, columns, ...extra });
  }
  const cols = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Column ${i}` }));

  it('accepts 2 to 4 named columns', () => {
    for (const n of [2, 3, 4]) expect(validateCustomFormat(custom(cols(n))).ok).toBe(true);
  });

  it('rejects 1 column and 5 columns for a format created from scratch', () => {
    expect(validateCustomFormat(custom(cols(1))).ok).toBe(false);
    expect(validateCustomFormat(custom(cols(5))).ok).toBe(false);
  });

  it('accepts the unchanged 5-column copy of a library format, but not more than it had', () => {
    const copy = custom(cols(5), { basedOn: { id: 'starfish', columnCount: 5 } });
    expect(validateCustomFormat(copy).ok).toBe(true);
    const grown = custom(cols(6), { basedOn: { id: 'starfish', columnCount: 5 } });
    expect(validateCustomFormat(grown).ok).toBe(false);
  });
});
