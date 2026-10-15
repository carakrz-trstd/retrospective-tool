import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import * as clipboard from '../../src/doc/clipboard';
import * as download from '../../src/doc/download';
import { renderCsv } from '../../src/doc/csv';
import { renderHtmlDocument } from '../../src/doc/html';
import { loadFinal } from '../../src/doc/finalStore';
import { renderMarkdown } from '../../src/doc/markdown';
import { docApp } from './docHelpers';

let downloads: Parameters<typeof download.downloadFile>[];

beforeEach(() => {
  downloads = [];
  vi.spyOn(download, 'downloadFile').mockImplementation((...args) => void downloads.push(args));
});
afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('export buttons (AC-5, AC-6, AC-7, AC-8, AC-9, AC-13, AC-14)', () => {
  it('Markdown, HTML and CSV call the download helper with the expected name, type and content and then mark the export', async () => {
    const { q, model, t, state } = docApp({ title: 'Team Alpha' });
    fireEvent.click(q.getByRole('button', { name: 'Download Markdown' }));
    fireEvent.click(q.getByRole('button', { name: 'Download HTML' }));
    fireEvent.click(q.getByRole('button', { name: 'Download CSV for Miro' }));
    expect(downloads).toEqual([
      ['team-alpha-2026-03-01.md', 'text/markdown', renderMarkdown(model)],
      ['team-alpha-2026-03-01.html', 'text/html', renderHtmlDocument(model)],
      ['team-alpha-2026-03-01.csv', 'text/csv', renderCsv(model)],
    ]);
    await q.findByText('Markdown file downloaded.');
    await q.findByText('HTML file downloaded.');
    await q.findByText('CSV file downloaded.');
    expect(loadFinal(state.sessionId, t.device.store)!.exports).toEqual({
      markdown: true,
      rich: false,
      html: true,
      csv: true,
    });
  });

  it('"Copy for Confluence" shows "Copied" for the clipboard path', async () => {
    vi.spyOn(clipboard, 'copyRichText').mockResolvedValue('clipboard');
    const { q } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Copy for Confluence' }));
    await q.findByText('Copied. Paste it into your Confluence page.');
  });

  it('shows a note for the fallback path', async () => {
    vi.spyOn(clipboard, 'copyRichText').mockResolvedValue('fallback');
    const { q, state, t } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Copy for Confluence' }));
    await q.findByText('Copied with the fallback method. Paste it into your Confluence page.');
    await waitFor(() => expect(loadFinal(state.sessionId, t.device.store)!.exports.rich).toBe(true));
  });

  it('shows an error and suggests the HTML download when copying fails, and does not mark the export', async () => {
    vi.spyOn(clipboard, 'copyRichText').mockResolvedValue('failed');
    const { q, state, t } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Copy for Confluence' }));
    await q.findByText('Copying did not work in this browser. Download the HTML file instead.');
    expect(loadFinal(state.sessionId, t.device.store)!.exports.rich).toBe(false);
  });

  it('a download that cannot start shows an error and is not marked', async () => {
    vi.spyOn(download, 'downloadFile').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { q, state, t } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Download Markdown' }));
    await q.findByText('The download could not be started. Try again or use another format.');
    expect(loadFinal(state.sessionId, t.device.store)!.exports.markdown).toBe(false);
  });

  it('the status list shows the marks and the other buttons stay enabled after an export', async () => {
    const { q } = docApp();
    const status = q.getByRole('list', { name: 'Completed exports' });
    expect(status.textContent).toBe(
      'Markdown – not yetCopied for Confluence – not yetHTML – not yetCSV – not yet',
    );
    fireEvent.click(q.getByRole('button', { name: 'Download Markdown' }));
    await waitFor(() => expect(status.textContent).toContain('Markdown ✓'));
    for (const name of [
      'Download Markdown',
      'Copy for Confluence',
      'Download HTML',
      'Download CSV for Miro',
    ]) {
      expect((q.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('starts from the marks of a stored record (after a reload)', () => {
    const { q } = docApp({ exports: { html: true, csv: true } });
    const text = q.getByRole('list', { name: 'Completed exports' }).textContent;
    expect(text).toContain('HTML ✓');
    expect(text).toContain('CSV ✓');
    expect(text).toContain('Markdown – not yet');
  });

  it('sends nothing over the network', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { q } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Download Markdown' }));
    fireEvent.click(q.getByRole('button', { name: 'Download CSV for Miro' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
