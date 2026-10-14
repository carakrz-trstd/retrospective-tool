import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor, within } from '@testing-library/preact';
import { App } from '../../src/app/App';
import { resetRegistries } from '../../src/core/registry';
import { resetFlowRegistries } from '../../src/flow/registries';
import { makeApp } from '../appHelpers';
import { RawClient } from '../hostHelpers';
import { runningSession } from '../ui/flowHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  resetFlowRegistries();
  localStorage.clear();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const timerText = (q: ReturnType<typeof within>) => q.getByRole('timer').textContent;

describe('flow integration with the Epic 1 host and client', () => {
  it('when the Facilitator starts the session every device shows the flow at check-in', async () => {
    const { host, people } = await runningSession({ participants: ['Alex', 'Blake'] });
    expect(host.t.app.flowState().stop).toBe('checkIn');
    for (const p of Object.values(people)) {
      expect(p.q.getByText('Step 1 of 8')).toBeTruthy();
      expect(p.q.getByRole('heading', { name: 'Check-in' })).toBeTruthy();
    }
  });

  it('a client that joins late sees the current stop and a correct timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, net, code } = await runningSession();
    host.t.app.flowIntent('flow.next');
    host.t.app.flowIntent('flow.timer', { action: 'start' }); // 5:00 at the review stop
    await waitFor(() => expect(host.q.getByText('Running')).toBeTruthy());
    await advance(30_000);

    const t = makeApp(net);
    const view = render(<App controller={t.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    t.app.boot();
    await t.app.join(code, 'Late', 'Developer');
    const q = within(view.container as HTMLElement);
    await q.findByText('Step 2 of 8');
    await waitFor(() => expect(['4:30', '4:29']).toContain(timerText(q)));
  });

  it('a client that reloads while a timer runs shows the correct remaining time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, net, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.timer', { action: 'start' });
    await waitFor(() => expect(people.Alex!.q.getByText('Running')).toBeTruthy());
    await advance(60_000);

    const alex = people.Alex!;
    alex.t.app.closeConnections();
    cleanup();
    const reloaded = makeApp(net, { device: alex.t.device });
    const view = render(<App controller={reloaded.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    reloaded.app.boot();
    const q = within(view.container as HTMLElement);
    await q.findByText('Step 1 of 8');
    await waitFor(() => expect(['4:00', '3:59']).toContain(timerText(q)));
  });

  it('when the Facilitator stops, clients show Facilitator offline and the not-synchronized timer; on resume everything converges', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, net, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.goto', { stop: 'notes' });
    host.t.app.flowIntent('flow.timer', { action: 'start' });
    const alex = people.Alex!;
    await waitFor(() => expect(alex.q.getByText('Running')).toBeTruthy());
    const sessionId = host.t.app.state.value!.sessionId;

    host.t.app.closeConnections();
    await advance(120_000);
    await alex.q.findByText('Not synchronized');
    expect(alex.q.getAllByText(/The Facilitator is offline/).length).toBeGreaterThan(0);

    const back = makeApp(net, { device: host.t.device });
    const view = render(<App controller={back.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    back.app.boot();
    await back.app.resume(sessionId);
    const q = within(view.container as HTMLElement);
    await q.findByText('Running');
    expect(back.app.flowState().stop).toBe('notes');
    expect(back.app.flowState().timers.notes?.status).toBe('running');
    await advance(60_000);
    await waitFor(() => expect(alex.q.queryByText('Not synchronized')).toBeNull());
    expect(alex.t.app.flowState().stop).toBe('notes');
  });

  it('every host-to-client message carries hostTime and the client clock uses it', async () => {
    const { host, net, people } = await runningSession({ participants: ['Alex'] });
    const raw = await new RawClient(net).connect(host.t.app.state.value!.sessionId);
    await raw.join('Raw');
    host.t.app.flowIntent('flow.next');
    await new Promise((r) => setTimeout(r, 10));
    expect(raw.messages.length).toBeGreaterThan(1);
    for (const m of raw.messages) expect(typeof (m as { hostTime?: unknown }).hostTime).toBe('number');
    // a participant's clock follows the host's clock (it was fed by hostTime of the messages)
    const mine = people.Alex!.t.app.clock.hostNow();
    expect(Math.abs(mine - host.t.app.clock.hostNow())).toBeLessThan(1_000);
  });
});
