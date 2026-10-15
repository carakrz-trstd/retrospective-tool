// Length limits and text rules. Limits count Unicode code points (an emoji counts as one).

export const ENTRY_MAX = 280;
export const NOTE_MAX = 1000;
export const ACTION_DESCRIPTION_MAX = 280;
export const COMMENT_MAX = 500;

export function length(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** Line breaks become \n, leading and trailing whitespace is removed. */
export function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, '\n').trim();
}

export type TextCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'too-long' };

export function validateText(s: string, max: number): TextCheck {
  const text = normalizeText(s);
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (length(text) > max) return { ok: false, reason: 'too-long' };
  return { ok: true, text };
}

/** Cuts the text at `max` code points (the input stops there while typing). */
export function truncate(s: string, max: number): string {
  let n = 0;
  let out = '';
  for (const ch of s) {
    if (n >= max) break;
    out += ch;
    n++;
  }
  return out;
}
