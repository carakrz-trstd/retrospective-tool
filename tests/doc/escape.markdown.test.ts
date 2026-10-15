import { describe, expect, it } from 'vitest';
import { escapeMarkdown } from '../../src/doc/escape';

/** What a Markdown reader shows for an escaped text: backslash escapes removed, <br> as a line break. */
function readBack(escaped: string): string {
  return escaped.replace(/<br>/g, '\n').replace(/\\([\\`*_[\]<>|~&#+\-.!()=])/g, '$1');
}

const NASTY = [
  '*bold*',
  '_x_',
  '# heading',
  '- item',
  '+ item',
  '1. item',
  '2) item',
  '[link](http://x)',
  '![img](http://x)',
  '<b>x</b>',
  'a | b',
  '`code`',
  'back\\slash',
  '> quote',
  '~~strike~~',
  '=== underline',
  '&amp; entity',
  '___',
  'two\nlines\n- and a list',
];

describe('escapeMarkdown (AC-18)', () => {
  it.each(NASTY)('shows %j as literal text', (text) => {
    expect(readBack(escapeMarkdown(text))).toBe(text);
  });

  it('puts a backslash before syntax characters, at the line start and inside the text', () => {
    expect(escapeMarkdown('*bold*')).toBe('\\*bold\\*');
    expect(escapeMarkdown('# heading')).toBe('\\# heading');
    expect(escapeMarkdown('- item')).toBe('\\- item');
    expect(escapeMarkdown('1. item')).toBe('1\\. item');
    expect(escapeMarkdown('[link](url)')).toBe('\\[link\\](url)');
    expect(escapeMarkdown('<b>')).toBe('\\<b\\>');
    expect(escapeMarkdown('a | b')).toBe('a \\| b');
    expect(escapeMarkdown('`c`')).toBe('\\`c\\`');
  });

  it('leaves ordinary text, long text and emoji unchanged', () => {
    expect(escapeMarkdown('Plain text, with commas: and a hyphen-ated word. Done!')).toBe(
      'Plain text, with commas: and a hyphen-ated word. Done!',
    );
    expect(escapeMarkdown('Great 🎉 team 😀')).toBe('Great 🎉 team 😀');
    const long = 'word '.repeat(2000);
    expect(escapeMarkdown(long)).toBe(long);
  });

  it('turns line breaks into <br> so that table cells and list items stay on one line', () => {
    expect(escapeMarkdown('one\ntwo')).toBe('one<br>two');
    expect(escapeMarkdown('one\r\ntwo')).toBe('one<br>two');
    expect(escapeMarkdown('one\n- two')).toBe('one<br>\\- two');
  });
});
