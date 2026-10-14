import { describe, expect, it } from 'vitest';
import { validateCustomFormat, validateFormat } from '../../src/formats/validate';
import type { Format } from '../../src/formats/types';
import { sampleFormat } from './sample';

function custom(columns: { id: string; name: string; prompt?: string }[]): Format {
  return sampleFormat({ id: 'custom-abc', custom: true, columns });
}

function errors(f: Format): string[] {
  const r = validateCustomFormat(f);
  return r.ok ? [] : r.errors;
}

describe('custom format text limits', () => {
  it('a 31-character column name fails with a message naming the field; 30 characters pass', () => {
    const long = 'x'.repeat(31);
    const e = errors(
      custom([
        { id: 'a', name: long },
        { id: 'b', name: 'Fine' },
      ]),
    );
    expect(e.some((m) => m.includes('columns.0.name'))).toBe(true);
    expect(
      validateCustomFormat(
        custom([
          { id: 'a', name: 'x'.repeat(30) },
          { id: 'b', name: 'Fine' },
        ]),
      ).ok,
    ).toBe(true);
  });

  it('a duplicate name that differs only in upper/lower case fails', () => {
    const e = errors(
      custom([
        { id: 'a', name: 'Ideas' },
        { id: 'b', name: 'ideas' },
      ]),
    );
    expect(e.some((m) => m.includes('columns.1.name') && /different/i.test(m))).toBe(true);
  });

  it('a 121-character prompt fails; 120 characters pass', () => {
    const e = errors(
      custom([
        { id: 'a', name: 'A', prompt: 'p'.repeat(121) },
        { id: 'b', name: 'B' },
      ]),
    );
    expect(e.some((m) => m.includes('columns.0.prompt'))).toBe(true);
    expect(
      validateCustomFormat(
        custom([
          { id: 'a', name: 'A', prompt: 'p'.repeat(120) },
          { id: 'b', name: 'B' },
        ]),
      ).ok,
    ).toBe(true);
  });

  it('library formats are not subject to the custom name rules', () => {
    const f = sampleFormat({
      columns: [
        { id: 'a', name: 'x'.repeat(40) },
        { id: 'b', name: 'X'.repeat(40) },
      ],
    });
    expect(validateFormat(f).ok).toBe(true);
  });
});
