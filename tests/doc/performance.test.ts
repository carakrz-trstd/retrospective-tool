import { describe, expect, it } from 'vitest';
import { renderCsv } from '../../src/doc/csv';
import { renderHtmlDocument } from '../../src/doc/html';
import { renderMarkdown } from '../../src/doc/markdown';
import { DOC_VERSION, type DocumentModel } from '../../src/doc/model';

function bigModel(): DocumentModel {
  const people = Array.from({ length: 8 }, (_, i) => `Person ${i + 1}`);
  const entry = (i: number) => ({
    author: people[i % 8]!,
    text: `Entry number ${i} with *special* <characters>, "quotes" and a line\nbreak, ${'x'.repeat(100)}`,
  });
  return {
    version: DOC_VERSION,
    incomplete: false,
    heading: 'Big retro',
    date: '2026-03-01',
    format: {
      name: 'Big',
      custom: false,
      columns: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
    },
    timeBudgetMin: 80,
    participants: people.map((name, i) => ({ name, role: 'Dev', isFacilitator: i === 0 })),
    checkIn: { question: 'How?', responses: people.map((author) => ({ author, text: 'fine' })) },
    retro: {
      columns: ['A', 'B', 'C', 'D'].map((name, c) => ({
        name,
        entries: Array.from({ length: 100 }, (_, i) => entry(c * 100 + i)),
      })),
    },
    notes: {
      noteTaker: 'Person 2',
      items: Array.from({ length: 40 }, (_, i) => ({ ...entry(i), text: `note ${i}` })),
    },
    actions: Array.from({ length: 20 }, (_, i) => ({
      description: `action ${i}`,
      owners: ['Person 1', 'Person 2'],
      dueDate: '2026-04-01',
    })),
    survey: {
      answered: 8,
      retro: { average: 4, distribution: [0, 1, 1, 3, 3], comments: ['ok'] },
      tool: { average: 4, distribution: [0, 0, 2, 3, 3], comments: ['ok'] },
    },
  };
}

describe('large documentation (AC-23, NFR-2)', () => {
  it('8 participants, 400 entries, 40 notes and 20 actions render to all formats in well under 2 seconds', () => {
    const model = bigModel();
    const started = performance.now();
    const md = renderMarkdown(model);
    const html = renderHtmlDocument(model);
    const csv = renderCsv(model);
    const elapsed = performance.now() - started;
    expect(md.length).toBeGreaterThan(40_000);
    expect(html.length).toBeGreaterThan(40_000);
    expect(csv.split('\n').length).toBeGreaterThan(460);
    expect(elapsed).toBeLessThan(2_000);
  });
});
