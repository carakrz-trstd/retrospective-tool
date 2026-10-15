import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../src/app/App';
import { registerEndGuard, resetRegistries } from '../src/core/registry';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { chooseFormat, makeApp, makeBrowser, renderApp, type TestApp } from './appHelpers';
import { joinClient, startHost } from './sessionHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  vi.useRealTimers();
});

/** A Facilitator app that has created a session (rendered into its own container). */
async function hostApp(net: MemoryNetwork, over: Parameters<typeof makeApp>[1] = {}) {
  const t = makeApp(net, over);
  const view = render(<App controller={t.app} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  t.app.boot();
  chooseFormat(t.app);
  await t.app.createSession({ name: 'Fiona', role: 'Scrum Master' });
  const q = within(view.container as HTMLElement);
  await q.findByRole('heading', { name: 'Lobby' });
  const state = t.app.state.value!;
  return { t, q, view, sessionId: state.sessionId, code: state.joinCode };
}

async function participantApp(net: MemoryNetwork, target: string, name: string, role = 'Developer') {
  const t = makeApp(net, { hash: `#/join/${target}` });
  const view = render(<App controller={t.app} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  t.app.boot();
  const q = within(view.container as HTMLElement);
  fireEvent.input(await q.findByLabelText('Your name'), { target: { value: name } });
  fireEvent.input(q.getByLabelText('Your role'), { target: { value: role } });
  fireEvent.submit(view.container.querySelector('form')!);
  await q.findByText('Waiting for the Facilitator to start the session…');
  return { t, q, view };
}

describe('lobby', () => {
  it('shows every participant with role and online status; duplicates get a suffix', async () => {
    const net = new MemoryNetwork();
    const { t, q, code } = await hostApp(net);
    const a = joinClient(net, code, 'Sam', 'Developer');
    const b = joinClient(net, code, 'Sam', 'Tester');
    await a.client.ready;
    await b.client.ready;
    await q.findByText('Sam (2)');
    expect(q.getByText('Sam')).toBeTruthy();
    expect(q.getByText('Tester')).toBeTruthy();
    expect(q.getAllByText('online').length).toBe(3);
    b.client.stop();
    await waitFor(() => expect(q.getAllByText('offline').length).toBe(1));
    expect(t.app.role.value).toBe('host');
  });

  it('only the Facilitator has a Start button', async () => {
    const net = new MemoryNetwork();
    const { q, code } = await hostApp(net);
    expect(q.getByRole('button', { name: 'Start session' })).toBeTruthy();
    const p = await participantApp(net, code, 'Alex');
    expect(p.q.queryByRole('button', { name: 'Start session' })).toBeNull();
  });

  it('with 9 participants the Facilitator sees the soft warning and nobody is refused', async () => {
    const net = new MemoryNetwork();
    const { q, code } = await hostApp(net);
    expect(q.queryByTestId('too-many-warning')).toBeNull();
    const clients = [];
    for (let i = 0; i < 8; i++) clients.push(joinClient(net, code, `Person ${i}`));
    for (const c of clients) await c.client.ready;
    await q.findByTestId('too-many-warning'); // 9 people: the Facilitator and 8 joined
    const ninth = joinClient(net, code, 'Ninth');
    await ninth.client.ready; // still joins
    expect(Object.keys(ninth.client.snapshot.state!.participants).length).toBe(10);
  });
});

describe('connection banner and notices', () => {
  function setRole(t: TestApp, role: 'host' | 'participant') {
    t.app.role.set(role);
    t.app.state.set({ sessionId: 'S' } as never);
  }

  it('shows connecting, reconnecting and Facilitator offline', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    setRole(t, 'participant');
    for (const [status, text] of [
      ['connecting', /Connecting/],
      ['reconnecting', /Reconnecting/],
      ['facilitator-offline', /Facilitator is offline/],
    ] as const) {
      t.app.connection.set({ status, longOffline: false, hostWaiting: false, readOnly: false });
      await screen.findByText(text);
    }
    t.app.connection.set({ status: 'online', longOffline: false, hostWaiting: false, readOnly: false });
    await waitFor(() => expect(screen.queryByTestId('connection-banner')).toBeNull());
  });

  it('the long-offline hint and "Leave session" appear when longOffline is true', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    setRole(t, 'participant');
    t.app.connection.set({
      status: 'facilitator-offline',
      longOffline: false,
      hostWaiting: false,
      readOnly: false,
    });
    await screen.findByText(/Facilitator is offline/);
    expect(screen.queryByTestId('long-offline-hint')).toBeNull();
    t.app.connection.set({
      status: 'facilitator-offline',
      longOffline: true,
      hostWaiting: false,
      readOnly: false,
    });
    const hint = await screen.findByTestId('long-offline-hint');
    expect(within(hint).getByRole('button', { name: 'Leave session' })).toBeTruthy();
    expect(within(hint).getByText(/Copy anything you wrote/)).toBeTruthy();
  });

  it('shows that the host waits for the connection service', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    setRole(t, 'host');
    t.app.connection.set({ status: 'host', longOffline: false, hostWaiting: true, readOnly: false });
    await screen.findByText(/Waiting for the connection service/);
  });

  it('the internal-use notice is on every screen', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    for (const screenName of ['home', 'create', 'join', 'lobby', 'session', 'ended', 'removed'] as const) {
      t.app.screen.set(screenName);
      await waitFor(() => expect(screen.getByText(/internal use only/i)).toBeTruthy());
    }
  });
});

describe('end session', () => {
  it('asks for confirmation, shows the messages of end guards, and ends the session for everybody', async () => {
    registerEndGuard(() => ({ message: '3 entries are still hidden.' }));
    const net = new MemoryNetwork();
    const { t, q, code } = await hostApp(net);
    const a = joinClient(net, code, 'Alex');
    await a.client.ready;
    fireEvent.click(q.getByRole('button', { name: 'Start session' }));
    await q.findByRole('heading', { name: 'Session' });
    fireEvent.click(q.getByRole('button', { name: 'End session' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('3 entries are still hidden.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(t.app.state.value!.status).toBe('running');

    fireEvent.click(q.getByRole('button', { name: 'End session' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'End session anyway' }),
    );
    await q.findByRole('heading', { name: 'The session has ended' });
    await waitFor(() => expect(a.client.snapshot.status).toBe('ended'));
    // no further changes: a joining person is refused
    const late = joinClient(net, code, 'Late');
    await expect(late.client.ready).rejects.toMatchObject({ reason: 'session-ended' });
  });

  it('without guard messages the dialog has a plain confirm button', async () => {
    const net = new MemoryNetwork();
    const { q } = await hostApp(net);
    fireEvent.click(q.getByRole('button', { name: 'Start session' }));
    await q.findByRole('heading', { name: 'Session' });
    fireEvent.click(q.getByRole('button', { name: 'End session' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'End session' }));
    await q.findByRole('heading', { name: 'The session has ended' });
  });
});

describe('remove participant', () => {
  it('only the Facilitator sees the remove action; after confirming the person is gone from all lists and sees the removal message', async () => {
    const net = new MemoryNetwork();
    const { q, code } = await hostApp(net);
    const alex = await participantApp(net, code, 'Alex');
    const blake = await participantApp(net, code, 'Blake');
    await q.findByText('Blake');
    // participants have no remove buttons
    expect(alex.q.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(q.queryByRole('button', { name: 'Remove Fiona' })).toBeNull();

    fireEvent.click(q.getByRole('button', { name: 'Remove Blake' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove from session' }),
    );
    await waitFor(() => expect(q.queryByText('Blake')).toBeNull());
    await waitFor(() => expect(alex.q.queryByText('Blake')).toBeNull());
    await blake.q.findByRole('heading', { name: 'You were removed from the session' });
  });
});

describe('leave session', () => {
  it('returns to the home screen, shows the person as offline for the Facilitator, and offers "Rejoin session"', async () => {
    const net = new MemoryNetwork();
    const { q, code } = await hostApp(net);
    const alex = await participantApp(net, code, 'Alex');
    await q.findByText('Alex');
    fireEvent.click(alex.q.getByRole('button', { name: 'Leave session' }));
    await alex.q.findByRole('button', { name: 'Create session' });
    await waitFor(() => expect(q.getAllByText('offline').length).toBe(1));
    expect(q.getByText('Alex')).toBeTruthy(); // still in the list, offline
    const rejoin = await alex.q.findByRole('button', { name: 'Rejoin session' });
    fireEvent.click(rejoin);
    await waitFor(() => expect(q.getAllByText('online').length).toBe(2));
  });
});

describe('take over', () => {
  it('a second tab of the same browser is offered "Take over"; afterwards the first tab is read-only', async () => {
    const net = new MemoryNetwork();
    const browser = makeBrowser();
    const first = await hostApp(net, { browser });
    const sessionId = first.sessionId;
    // the same browser: same storage, same locks
    const second = makeApp(net, { browser, device: first.t.device });
    const view2 = render(<App controller={second.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    second.app.boot();
    const q2 = within(view2.container as HTMLElement);
    fireEvent.click(await q2.findByRole('button', { name: 'Resume session' }));
    const dialog = await screen.findByRole('dialog', { name: 'This session is open in another tab' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take over' }));
    await q2.findByRole('heading', { name: 'Lobby' });
    expect(second.app.role.value).toBe('host');
    await first.q.findByText(/This session is now hosted in another tab/);
    expect(first.q.getByRole('button', { name: 'Start session' }).hasAttribute('disabled')).toBe(true);
    expect(first.t.app.connection.value.readOnly).toBe(true);
    void sessionId;
  });
});

describe('cleanup', () => {
  it('finishing an ended session removes everything this device keeps for it', async () => {
    const net = new MemoryNetwork();
    const { t, q } = await hostApp(net);
    const sessionId = t.app.state.value!.sessionId;
    fireEvent.click(q.getByRole('button', { name: 'Start session' }));
    await q.findByRole('heading', { name: 'Session' });
    t.app.endSession();
    expect(t.device.store.loadHostRecord(sessionId)).not.toBeNull(); // kept until the person leaves
    fireEvent.click(await q.findByRole('button', { name: 'Done: remove this session from this device' }));
    // Epic 5: leaving without an export asks for confirmation first
    fireEvent.click(within(q.getByRole('dialog')).getByRole('button', { name: 'Leave without exporting' }));
    await q.findByRole('button', { name: 'Create session' });
    expect(t.device.store.loadHostRecord(sessionId)).toBeNull();
    expect(t.device.store.listIndex()).toEqual([]);
    expect(t.device.store.getActiveSession()).toBeNull();
  });

  it('the 24-hour sweep runs at app start and removes records not written for 24 hours', async () => {
    const net = new MemoryNetwork();
    const { host, device } = await startHost(net);
    host.stop();
    expect(device.store.listIndex()).toHaveLength(1);
    const realNow = Date.now;
    Date.now = () => realNow() + 25 * 60 * 60 * 1000;
    try {
      const t = makeApp(net, { device });
      renderApp(t);
      expect(device.store.listIndex()).toEqual([]);
      expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});
