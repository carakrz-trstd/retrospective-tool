import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, waitFor } from '@testing-library/preact';
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

/** Fires beforeunload the way the browser does and tells whether the page asked for the warning. */
function asksBeforeLeaving(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('closing the tab (AC-12, AD-14)', () => {
  it('while nothing is exported the page asks the browser to show its warning', () => {
    docApp();
    expect(asksBeforeLeaving()).toBe(true);
  });

  it('after the first export the handler is gone', async () => {
    vi.spyOn(download, 'downloadFile').mockImplementation(() => {});
    const { q } = docApp();
    fireEvent.click(q.getByRole('button', { name: 'Download CSV for Miro' }));
    await q.findByText('CSV file downloaded.');
    expect(asksBeforeLeaving()).toBe(false);
  });

  it('a page that starts with an export already marked does not ask', () => {
    docApp({ exports: { markdown: true } });
    expect(asksBeforeLeaving()).toBe(false);
  });

  it('the handler is removed when the page goes away', async () => {
    const view = docApp();
    expect(asksBeforeLeaving()).toBe(true);
    view.q.getByRole('heading', { name: 'The session has ended' });
    cleanup();
    // effect cleanups run a moment after the unmount
    await waitFor(() => expect(asksBeforeLeaving()).toBe(false));
  });

  it('closing or reloading never removes the local data', () => {
    const { state, t } = docApp();
    asksBeforeLeaving();
    window.dispatchEvent(new Event('pagehide'));
    expect(loadFinal(state.sessionId, t.device.store)).not.toBeNull();
  });
});
