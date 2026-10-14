import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/preact';
import { joinLink, parseHash, targetFromInput } from '../src/app/router';
import { Store } from '../src/storage/storage';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { makeApp, renderApp } from './appHelpers';
import { joinClient, makeDevice, startHost, type Device } from './sessionHelpers';
import { MemoryStorage } from './storageFakes';

afterEach(() => cleanup());

describe('router helpers', () => {
  it('parses the hash routes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/create')).toEqual({ name: 'create' });
    expect(parseHash('#/join/ABC123xyz')).toEqual({ name: 'join', target: 'ABC123xyz' });
    expect(parseHash('#/join')).toEqual({ name: 'join', target: '' });
    expect(parseHash('#/session')).toEqual({ name: 'session' });
    expect(parseHash('#/something-else')).toEqual({ name: 'home' });
  });

  it('builds the join link on the page address without an old hash', () => {
    expect(joinLink('https://retro.example/app/#/session', 'ID1')).toBe(
      'https://retro.example/app/#/join/ID1',
    );
    expect(joinLink('https://retro.example/app/', 'ID1')).toBe('https://retro.example/app/#/join/ID1');
  });

  it('takes the session ID out of a pasted link and leaves codes alone', () => {
    expect(targetFromInput('https://retro.example/app/#/join/ID1')).toBe('ID1');
    expect(targetFromInput('  k7m4qx ')).toBe('k7m4qx');
    expect(targetFromInput('')).toBe('');
  });
});

describe('address bar and reload', () => {
  it('after joining, the session ID is no longer in the address bar and the tab remembers the session', async () => {
    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    const t = makeApp(net, { hash: '#/join/SESSION1' });
    t.app.boot();
    await t.app.join('SESSION1', 'Alex', 'Dev');
    expect(t.router.hash).toBe('#/session');
    expect(t.device.store.getActiveSession()).toBe('SESSION1');
    host.stop();
  });

  it('a reload in the same tab rejoins by itself as the same person', async () => {
    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    const first = joinClient(net, 'SESSION1', 'Alex');
    await first.client.ready;
    const pid = first.client.snapshot.participantId;
    first.client.stop(); // the page is closed; the tab pointer stays (sessionStorage survives a reload)

    const t = makeApp(net, { device: first.device });
    renderApp(t);
    expect(t.app.role.value).toBe('participant');
    await waitFor(() => expect(t.app.connection.value.status).toBe('online'));
    expect(t.app.myParticipantId.value).toBe(pid);
    expect(Object.keys(host.data.state.participants)).toHaveLength(2);
    host.stop();
  });

  it('a new tab (no pointer) shows the home screen with "Rejoin session" for the stored record', async () => {
    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    const first = joinClient(net, 'SESSION1', 'Alex');
    await first.client.ready;
    first.client.stop();

    const newTab: Device = {
      ...first.device,
      store: new Store({
        local: first.device.local,
        session: new MemoryStorage(),
        now: () => Date.now(),
        expiryMs: 86_400_000,
      }),
    };
    renderApp(makeApp(net, { device: newTab }));
    expect(screen.getByRole('button', { name: 'Rejoin session' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create session' })).toBeTruthy();
    host.stop();
  });

  it('a Facilitator who reloads is offered to resume (never resumed automatically)', async () => {
    const net = new MemoryNetwork();
    const { host, device } = await startHost(net);
    host.stop();
    renderApp(makeApp(net, { device }));
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeTruthy();
  });

  it('a different browser has no host record and is not offered a resume', () => {
    const net = new MemoryNetwork();
    renderApp(makeApp(net, { device: makeDevice(net) }));
    expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull();
  });

  it('pasting a join link into the address bar opens the join form', async () => {
    const net = new MemoryNetwork();
    const t = makeApp(net);
    renderApp(t);
    t.router.navigate('#/join/PASTEDID');
    await screen.findByLabelText('Your name');
    expect(t.app.joinTarget.value).toBe('PASTEDID');
  });
});
