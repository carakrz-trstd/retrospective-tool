import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/preact';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('privacy: the format selection sends nothing and stores nothing (AC-19, AC-13)', () => {
  it('runs the questionnaire, suggestion, library and custom format without network calls or storage writes', async () => {
    const fetchSpy = vi.fn();
    const xhrOpen = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        open = xhrOpen;
        send() {}
      },
    );
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const idbOpen = vi.fn();
    vi.stubGlobal('indexedDB', { open: idbOpen });

    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    // the controller reads the stores at boot; spies start counting after that
    renderApp(t);
    setItem.mockClear();

    for (const name of ['Tired', 'Have fun', '30 minutes', 'Lean', 'Remote']) {
      fireEvent.click(screen.getByRole('radio', { name }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Show recommendation' }));
    await screen.findByRole('heading', { name: 'Our suggestion' });
    fireEvent.click(screen.getByRole('button', { name: 'Browse all formats' }));
    await screen.findByRole('heading', { name: 'All formats' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the questions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create custom format' }));
    await screen.findByLabelText('Column 1 name');
    fireEvent.input(screen.getByLabelText('Column 1 name'), { target: { value: 'Ideas' } });
    fireEvent.input(screen.getByLabelText('Column 2 name'), { target: { value: 'Problems' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByRole('heading', { name: 'Chosen format' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(idbOpen).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
});
