import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { docApp } from './docHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  localStorage.clear();
});

const BUTTONS = ['Download Markdown', 'Copy for Confluence', 'Download HTML', 'Download CSV for Miro'];

describe('documentation page (AC-4, AC-11, AC-15, AC-20)', () => {
  it('shows the save warning at the top, the preview and four export buttons', () => {
    const { q, container } = docApp();
    const warning = q.getByText(
      'This session is not saved. Save or download the documentation to your device before you leave.',
    );
    expect(warning).toBeTruthy();
    // the warning comes before the preview and the buttons
    const order = [...container.querySelectorAll('.save-warning, .doc-preview, .export-buttons')].map(
      (e) => e.className.split(' ')[0],
    );
    expect(order).toEqual(['save-warning', 'doc-preview', 'export-buttons']);
    expect(q.getByRole('heading', { name: 'The session has ended' })).toBeTruthy();
    expect(q.getByRole('article', { name: 'Preview of the documentation' })).toBeTruthy();
    for (const name of BUTTONS) expect(q.getByRole('button', { name })).toBeTruthy();
  });

  it('a participant who is not the Facilitator sees the same page and buttons', () => {
    const host = docApp({ role: 'host' });
    const participant = docApp({ role: 'participant' });
    for (const name of BUTTONS) expect(participant.q.getByRole('button', { name })).toBeTruthy();
    expect(participant.container.querySelector('.doc-preview')!.textContent).toBe(
      host.container.querySelector('.doc-preview')!.textContent,
    );
  });

  it('shows the incomplete note only for an incomplete model', () => {
    const complete = docApp();
    expect(complete.q.queryByText(/Some content may be missing/)).toBeNull();
    cleanup();
    const incomplete = docApp({ incomplete: true });
    expect(
      incomplete.q.getByText(
        'Some content may be missing because the Facilitator left before the session was ended.',
      ),
    ).toBeTruthy();
  });

  it('shows the action items as a table in the preview', () => {
    const { container } = docApp();
    const table = container.querySelector('.doc-preview table')!;
    expect([...table.querySelectorAll('th')].map((c) => c.textContent)).toEqual([
      'Action',
      'Owner(s)',
      'Due date',
    ]);
    expect([...table.querySelectorAll('tbody td')].map((c) => c.textContent)).toEqual([
      'write the docs',
      'Alex, Blake',
      '2026-03-15',
    ]);
  });

  it('shows the heading with the title when there is one', () => {
    const { q } = docApp({ title: 'Team Alpha' });
    expect(q.getByRole('heading', { name: 'Team Alpha', level: 1 })).toBeTruthy();
  });

  it('tells the person when the documentation could not be stored on this device', () => {
    const { q, app } = docApp();
    expect(q.queryByText(/could not be stored on this device/)).toBeNull();
    app.docPersisted.set(false);
    return q.findByText(/could not be stored on this device/);
  });
});
