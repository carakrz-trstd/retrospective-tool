import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { csvCell } from '../../src/doc/escape';
import { renderCsv } from '../../src/doc/csv';
import { parseCsv, sampleSession } from './sample';

const csv = (over = {}) => renderCsv(buildDocumentModel(sampleSession(over), { incomplete: false }));

describe('csvCell (AC-10, AC-18)', () => {
  it('quotes, doubles inner quotes and keeps line breaks', () => {
    expect(csvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
    expect(csvCell('')).toBe('');
  });

  it.each(['=SUM(A1)', '+1', '-5', '@user', '\t=1', '\r=1', '-', '=cmd|calc'])(
    'protects %j with a leading single quote',
    (text) => {
      const cell = csvCell(text);
      // line breaks inside cells are kept as LF, so a lone carriage return becomes LF after the quote
      expect(parseCsv(cell)[0]![0]).toBe(`'${text.replace(/\r\n?/g, '\n')}`);
    },
  );

  it('leaves text that merely contains these characters later unchanged', () => {
    for (const t of ['a=b', 'x+y', 'a-b', 'mail@me', "it's"]) expect(parseCsv(csvCell(t))[0]![0]).toBe(t);
  });
});

describe('renderCsv (AC-9, AC-10, AC-18)', () => {
  it('has the exact header, comma separated', () => {
    expect(csv().split('\n')[0]).toBe('Type,Column,Text,Author,Owner(s),Due date');
  });

  it('has one row per item in the order check-in, retro, notes, action items', () => {
    const rows = parseCsv(csv());
    expect(rows.slice(1)).toEqual([
      ['Check-in', 'Check-in', 'sleepy but here', 'Alex', '', ''],
      ['Check-in', 'Check-in', 'fine', 'Blake', '', ''],
      ['Retro entry', 'Alpha', 'start testing', 'Alex', '', ''],
      ['Retro entry', 'Beta', 'stop meetings', 'Blake', '', ''],
      ['Note', 'Discussion notes', 'we agreed on X', 'Alex', '', ''],
      ['Action item', 'Action items', 'write the docs', '', 'Alex, Blake', '2026-03-15'],
    ]);
  });

  it('does not contain the check-out results', () => {
    expect(csv()).not.toMatch(/great retro|slow on my phone|average/);
  });

  it('keeps commas, quotes and line breaks in one cell and protects formulas', () => {
    const rows = parseCsv(csv({ special: true }));
    const row = rows.find((r) => r[1] === 'Gamma')!;
    // the entry starts with "*", so it is not a formula; the formula inside is untouched text
    expect(row[2]).toBe('*bold* <b>x</b> =SUM(A1), "quoted" & more');
    expect(rows.every((r) => r.length === 6)).toBe(true);
  });

  it('protects an entry that starts with a formula character', () => {
    const state = sampleSession();
    const contrib = state.extensions.contrib as { entries: Record<string, { text: string }> };
    contrib.entries['r-1']!.text = '=HYPERLINK("http://x")';
    const rows = parseCsv(renderCsv(buildDocumentModel(state, { incomplete: false })));
    expect(rows.find((r) => r[1] === 'Alpha')![2]).toBe(`'=HYPERLINK("http://x")`);
  });

  it('is UTF-8 without a byte order mark, with LF line endings; umlauts and emoji survive', () => {
    const state = sampleSession();
    const contrib = state.extensions.contrib as { entries: Record<string, { text: string }> };
    contrib.entries['r-2']!.text = 'Größe 🎉\nzweite Zeile';
    const text = renderCsv(buildDocumentModel(state, { incomplete: false }));
    const bytes = new TextEncoder().encode(text);
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(text).not.toContain('\r');
    expect(parseCsv(text).find((r) => r[1] === 'Beta')![2]).toBe('Größe 🎉\nzweite Zeile');
  });

  it('an empty model has only the header', () => {
    const rows = parseCsv(
      renderCsv(buildDocumentModel({ ...sampleSession(), extensions: {} }, { incomplete: false })),
    );
    expect(rows).toEqual([['Type', 'Column', 'Text', 'Author', 'Owner(s)', 'Due date']]);
  });
});
