import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/preact';
import { App } from '../../src/app/App';
import { resetBannerActions } from '../../src/app/bannerActions';
import { loadFinal } from '../../src/doc/finalStore';
import { registerDocViews } from '../../src/ui/doc/registerViews';
import { makeApp } from '../appHelpers';
import { contribSession, goTo, resetContrib, type } from '../ui/contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
  resetBannerActions();
  vi.useRealTimers();
});

type Session = Awaited<ReturnType<typeof contribSession>>;

/** Alex and Blake write, the Facilitator reveals and moves on. */
async function writeAndReveal(s: Session) {
  const [alex, blake] = [s.people.Alex!, s.people.Blake!];
  goTo(s.host, 'retro.write');
  await alex.q.findByLabelText('New entry for Start');
  type(alex.q.getByLabelText('New entry for Start'), 'alex idea');
  fireEvent.click(alex.q.getByRole('button', { name: 'Add entry to Start' }));
  type(blake.q.getByLabelText('New entry for Stop'), 'blake idea');
  fireEvent.click(blake.q.getByRole('button', { name: 'Add entry to Stop' }));
  await s.host.q.findByText('2 of 3 have added something');
  s.host.t.app.flowIntent('flow.reveal', { key: 'retro' });
  await alex.q.findByText('blake idea');
}

async function end(s: Session) {
  s.host.t.app.endSession();
  for (const d of [s.host, ...Object.values(s.people)]) {
    await d.q.findByRole('heading', { name: 'The session has ended' });
    await d.q.findByRole('article', { name: 'Preview of the documentation' });
  }
}

describe('ending the session with the real host and clients (AC-11, AC-15, AC-16)', () => {
  it('shows the documentation on all devices, kept on each device, also when the Facilitator is gone', async () => {
    const s = await contribSession({ participants: ['Alex', 'Blake'] });
    await writeAndReveal(s);
    await end(s);
    for (const d of [s.host, s.people.Alex!, s.people.Blake!]) {
      const preview = d.container.querySelector('.doc-preview')!;
      expect(preview.textContent).toContain('alex idea (Alex)');
      expect(preview.textContent).toContain('blake idea (Blake)');
      expect(d.q.getByText(/This session is not saved/)).toBeTruthy();
    }
    const texts = [s.host, ...Object.values(s.people)].map(
      (d) => d.container.querySelector('.doc-preview')!.textContent,
    );
    expect(new Set(texts).size).toBe(1);
    for (const d of [s.host, ...Object.values(s.people)]) {
      const sessionId = d.t.app.state.value!.sessionId;
      expect(loadFinal(sessionId, d.t.device.store)).not.toBeNull();
    }
    // the Facilitator goes away: the participants still have it
    s.host.t.app.closeConnections();
    const alex = s.people.Alex!;
    expect(alex.q.getByRole('article', { name: 'Preview of the documentation' })).toBeTruthy();
  });

  it('the old placeholder of Epic 1 is gone', async () => {
    const s = await contribSession({ participants: ['Alex'] });
    await end(s);
    expect(s.people.Alex!.q.queryByText('Thank you for taking part.')).toBeNull();
    expect(existsSync('src/ui/EndedPage.tsx')).toBe(false);
  });

  it('a reload keeps the documentation and the export marks', async () => {
    const s = await contribSession({ participants: ['Alex'] });
    await end(s);
    const alex = s.people.Alex!;
    const sessionId = alex.t.app.state.value!.sessionId;
    alex.t.device.store.saveFinalRecord(sessionId, {
      ...loadFinal(sessionId, alex.t.device.store)!,
      exports: { markdown: true, rich: false, html: false, csv: false },
    });
    alex.t.app.closeConnections();
    cleanup();

    const reloaded = makeApp(s.net, { device: alex.t.device });
    const view = render(<App controller={reloaded.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    reloaded.app.boot();
    const q = within(view.container as HTMLElement);
    await q.findByRole('heading', { name: 'The session has ended' });
    expect(q.getByRole('list', { name: 'Completed exports' }).textContent).toContain('Markdown ✓');
  });

  it('a participant who was offline at the end gets the documentation when they come back', async () => {
    const s = await contribSession({ participants: ['Alex', 'Blake'] });
    await writeAndReveal(s);
    const blake = s.people.Blake!;
    blake.t.app.closeConnections();
    cleanup();
    s.host.t.app.endSession();
    await vi.waitFor(() => expect(s.host.t.app.state.value!.status).toBe('ended'));

    const back = makeApp(s.net, { device: blake.t.device });
    const view = render(<App controller={back.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    back.app.boot();
    const q = within(view.container as HTMLElement);
    await q.findByRole('article', { name: 'Preview of the documentation' });
    expect(view.container.querySelector('.doc-preview')!.textContent).toContain('alex idea (Alex)');
    expect(loadFinal(back.app.state.value!.sessionId, back.device.store)).not.toBeNull();
  });
});

describe('the Facilitator never ends the session (AC-17)', () => {
  it('after 15 minutes the banner offers an incomplete documentation with only revealed content', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    registerDocViews();
    const s = await contribSession({ participants: ['Alex', 'Blake'] });
    await writeAndReveal(s);
    const alex = s.people.Alex!;
    // a check-in response that the Facilitator never revealed
    goTo(s.host, 'checkIn');
    await alex.q.findByLabelText('Your check-in response');
    type(alex.q.getByLabelText('Your check-in response'), 'my unrevealed check-in');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add response' }));
    await alex.q.findByText('my unrevealed check-in');

    s.host.t.app.closeConnections();
    await act(() => void vi.advanceTimersByTime(60_000));
    expect(alex.q.queryByRole('button', { name: 'Open documentation (may be incomplete)' })).toBeNull();
    await act(() => void vi.advanceTimersByTime(16 * 60_000));
    const open = await alex.q.findByRole('button', { name: 'Open documentation (may be incomplete)' });
    fireEvent.click(open);

    await alex.q.findByText(/Some content may be missing/);
    const preview = alex.container.querySelector('.doc-preview')!.textContent!;
    expect(preview).toContain('alex idea (Alex)');
    expect(preview).toContain('blake idea (Blake)');
    expect(preview).not.toContain('my unrevealed check-in');
    expect(preview).toContain('Incomplete: the Facilitator left before the session was ended.');
    // the export buttons work from this device
    expect(alex.q.getByRole('button', { name: 'Download CSV for Miro' })).toBeTruthy();
  });
});

describe('the warning about hidden entries in the real app (AC-19)', () => {
  it("the Facilitator sees it although the hidden entries are not in the Facilitator's own view", async () => {
    const s = await contribSession({ participants: ['Alex'] });
    const alex = s.people.Alex!;
    await alex.q.findByLabelText('Your check-in response');
    type(alex.q.getByLabelText('Your check-in response'), 'nobody reveals this');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add response' }));
    await alex.q.findByText('nobody reveals this');
    await s.host.q.findByText('1 of 2 have added something');
    expect(s.host.q.queryByText('nobody reveals this')).toBeNull();

    fireEvent.click(s.host.q.getByRole('button', { name: 'End session' }));
    const dialog = s.host.q.getByRole('dialog');
    expect(
      within(dialog).getByText(/^1 entry is still hidden and will not be in the documentation/),
    ).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'End session anyway' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    s.host.t.app.flowIntent('flow.reveal', { key: 'checkIn' });
    await alex.q.findByText('nobody reveals this');
    fireEvent.click(s.host.q.getByRole('button', { name: 'End session' }));
    expect(within(s.host.q.getByRole('dialog')).queryByText(/still hidden/)).toBeNull();
  });
});
