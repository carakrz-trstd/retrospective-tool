import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { fileBase, fileName } from '../../src/doc/filenames';
import { sampleSession } from './sample';

const model = (title?: string, formatName?: string) => {
  const state = sampleSession(title ? { title } : {});
  if (formatName) state.format = { ...state.format, name: formatName };
  return buildDocumentModel(state, { incomplete: false });
};

describe('file names (AC-21)', () => {
  it('turns a title and the date into a slug', () => {
    expect(fileBase(model('Team Alpha: Q1 retro!'))).toBe('team-alpha-q1-retro-2026-03-01');
  });

  it('removes accents', () => {
    expect(fileBase(model('Crème brûlée Überblick'))).toBe('creme-brulee-uberblick-2026-03-01');
  });

  it('uses the format name without a title, and falls back to it when the slug is empty', () => {
    expect(fileBase(model())).toBe('start-stop-continue-2026-03-01');
    expect(fileBase(model('!!! ???'))).toBe('start-stop-continue-2026-03-01');
  });

  it('keeps the slug at 60 characters at most', () => {
    const base = fileBase(model('a'.repeat(200)));
    expect(base).toBe(`${'a'.repeat(60)}-2026-03-01`);
  });

  it('has the three extensions', () => {
    const m = model('Team');
    expect(fileName(m, 'markdown')).toBe('team-2026-03-01.md');
    expect(fileName(m, 'html')).toBe('team-2026-03-01.html');
    expect(fileName(m, 'csv')).toBe('team-2026-03-01.csv');
  });
});
