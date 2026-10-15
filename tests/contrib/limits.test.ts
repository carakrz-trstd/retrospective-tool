import { describe, expect, it } from 'vitest';
import {
  ACTION_DESCRIPTION_MAX,
  COMMENT_MAX,
  ENTRY_MAX,
  NOTE_MAX,
  length,
  normalizeText,
  truncate,
  validateText,
} from '../../src/contrib/limits';

describe('limits', () => {
  it('the limits are 280, 1000, 280 and 500', () => {
    expect([ENTRY_MAX, NOTE_MAX, ACTION_DESCRIPTION_MAX, COMMENT_MAX]).toEqual([280, 1000, 280, 500]);
  });

  it('length counts code points: an emoji is 1, a combining sequence counts per code point', () => {
    expect(length('abc')).toBe(3);
    expect(length('😀')).toBe(1);
    expect(length('a😀b')).toBe(3);
    expect(length('é')).toBe(2);
  });

  it('normalizeText converts CRLF to LF and trims', () => {
    expect(normalizeText('  a\r\nb \n')).toBe('a\nb');
  });

  it('validateText: empty and whitespace-only are empty; 280 is valid; 281 is too long', () => {
    expect(validateText('', 280)).toEqual({ ok: false, reason: 'empty' });
    expect(validateText(' \n\t ', 280)).toEqual({ ok: false, reason: 'empty' });
    expect(validateText('a'.repeat(280), 280)).toEqual({ ok: true, text: 'a'.repeat(280) });
    expect(validateText('a'.repeat(281), 280)).toEqual({ ok: false, reason: 'too-long' });
    expect(validateText('😀'.repeat(280), 280).ok).toBe(true);
    expect(validateText('😀'.repeat(281), 280).ok).toBe(false);
  });

  it.each([
    ['note', NOTE_MAX],
    ['action description', ACTION_DESCRIPTION_MAX],
    ['comment', COMMENT_MAX],
  ])('%s: at the limit valid, one above too long', (_name, max) => {
    expect(validateText('x'.repeat(max), max).ok).toBe(true);
    expect(validateText('x'.repeat(max + 1), max)).toEqual({ ok: false, reason: 'too-long' });
  });

  it('truncate cuts at the limit by code points', () => {
    expect(truncate('a'.repeat(300), 280)).toHaveLength(280);
    expect(length(truncate('😀'.repeat(300), 280))).toBe(280);
    expect(truncate('short', 280)).toBe('short');
  });
});
