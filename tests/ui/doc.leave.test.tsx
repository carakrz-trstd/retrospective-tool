import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import * as download from '../../src/doc/download';
import { loadFinal } from '../../src/doc/finalStore';
import { docApp } from './docHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
  vi.restoreAllMocks();
});

const DONE = { name: 'Done: remove this session from this device' };

describe('leaving the documentation (AC-12, AC-14)', () => {
  it('"Done" without any export asks for confirmation with the warning; cancelling keeps page and data', () => {
    const { q, state, t } = docApp();
    fireEvent.click(q.getByRole('button', DONE));
    const dialog = q.getByRole('dialog');
    expect(
      within(dialog).getByText('You have not exported anything. The documentation will be lost.'),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(q.queryByRole('dialog')).toBeNull();
    expect(q.getByRole('heading', { name: 'The session has ended' })).toBeTruthy();
    expect(loadFinal(state.sessionId, t.device.store)).not.toBeNull();
  });

  it('confirming removes the session data (including the final record) and goes home', async () => {
    const { q, state, t, app } = docApp();
    fireEvent.click(q.getByRole('button', DONE));
    fireEvent.click(within(q.getByRole('dialog')).getByRole('button', { name: 'Leave without exporting' }));
    await waitFor(() => expect(app.screen.value).toBe('home'));
    expect(loadFinal(state.sessionId, t.device.store)).toBeNull();
    expect(
      t.device.local.keys().filter((k) => k.startsWith('retro.final.') || k.startsWith('retro.participant.')),
    ).toEqual([]);
  });

  it('"Done" after an export removes the data without the extra warning (a plain confirmation is still shown)', async () => {
    vi.spyOn(download, 'downloadFile').mockImplementation(() => {});
    const { q, app, state, t } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Download Markdown' }));
    await q.findByText('Markdown file downloaded.');
    fireEvent.click(q.getByRole('button', DONE));
    const dialog = q.getByRole('dialog');
    expect(within(dialog).queryByText(/You have not exported anything/)).toBeNull();
    expect(within(dialog).getByText(/removed from this device and cannot be opened again/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from this device' }));
    await waitFor(() => expect(app.screen.value).toBe('home'));
    expect(loadFinal(state.sessionId, t.device.store)).toBeNull();
  });

  it('an export alone never removes data', async () => {
    vi.spyOn(download, 'downloadFile').mockImplementation(() => {});
    const { q, state, t } = docApp();
    for (const name of ['Download Markdown', 'Download HTML', 'Download CSV for Miro']) {
      fireEvent.click(q.getByRole('button', { name }));
    }
    await q.findByText('CSV file downloaded.');
    expect(loadFinal(state.sessionId, t.device.store)).not.toBeNull();
    expect(q.getByRole('heading', { name: 'The session has ended' })).toBeTruthy();
  });

  it('changing the hash away from the page before any export asks for confirmation; cancel keeps the page', async () => {
    const { q, state, t } = docApp();
    window.location.hash = '#/somewhere-else';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const dialog = await q.findByRole('dialog');
    expect(
      within(dialog).getByText('You have not exported anything. The documentation will be lost.'),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(q.queryByRole('dialog')).toBeNull();
    expect(loadFinal(state.sessionId, t.device.store)).not.toBeNull();
  });
});
