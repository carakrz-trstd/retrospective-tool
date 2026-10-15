import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { docApp } from './docHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
});

describe('documentation page on a phone (NFR-4)', () => {
  it('the buttons are stacked by default and reachable; the download hint is shown', () => {
    const { q, container } = docApp();
    const css = readFileSync('src/styles.css', 'utf8');
    const rule = css.match(/\.export-buttons\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('grid');
    expect(rule).not.toMatch(/grid-template-columns:\s*repeat/);
    expect(container.querySelectorAll('.export-buttons button')).toHaveLength(4);
    expect(q.getByText(/On some phones the file opens in a viewer instead of being saved/)).toBeTruthy();
    expect(q.getByText('Paste into a Confluence page')).toBeTruthy();
    expect(q.getByText('Import into a Miro board')).toBeTruthy();
  });
});
