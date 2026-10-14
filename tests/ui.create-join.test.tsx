import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { render } from '@testing-library/preact';
import { App } from '../src/app/App';
import { JOIN_CODE_ALPHABET } from '../src/core/ids';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { chooseFormat, makeApp, renderApp } from './appHelpers';
import { joinClient, makeDevice, startHost } from './sessionHelpers';

afterEach(() => cleanup());

function fill(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

describe('create session screen', () => {
  it('blocks submit with messages when name or role is empty', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    chooseFormat(t.app);
    await screen.findByLabelText('Your name');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Please enter your name.')).toBeTruthy();
    fill('Your name', 'Fiona');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Please enter your role.')).toBeTruthy();
  });

  it('creates the session: the lobby shows the link, a 6-character code, copy buttons and the Facilitator badge', async () => {
    const t = makeApp(new MemoryNetwork());
    renderApp(t);
    chooseFormat(t.app);
    await screen.findByLabelText('Your name');
    fill('Your name', 'Fiona');
    fill('Your role', 'Scrum Master');
    fill('Session title (optional)', 'Team Alpha');
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByRole('heading', { name: /Lobby: Team Alpha/ });

    const link = (screen.getByLabelText('Join link') as HTMLInputElement).value;
    expect(link).toMatch(/^https:\/\/retro\.example\/app\/#\/join\/[A-Za-z0-9]{22,}$/);
    const code = (screen.getByLabelText('Join code') as HTMLInputElement).value;
    expect(code).toHaveLength(6);
    for (const ch of code) expect(JOIN_CODE_ALPHABET).toContain(ch);
    expect(screen.getByRole('button', { name: 'Copy join link' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy join code' })).toBeTruthy();
    expect(screen.getByText('Facilitator')).toBeTruthy();
    expect(screen.getByText('Fiona')).toBeTruthy();
    // the session ID is removed from the address bar once the session exists
    expect(t.router.hash).toBe('#/session');
  });

  it('pre-fills name and role from this device and "Forget me" clears them', async () => {
    const net = new MemoryNetwork();
    const device = makeDevice(net);
    device.store.saveIdentity({ name: 'Fiona', role: 'Scrum Master' });
    const t = makeApp(net, { device });
    renderApp(t);
    chooseFormat(t.app);
    await screen.findByLabelText('Your name');
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Fiona');
    expect((screen.getByLabelText('Your role') as HTMLInputElement).value).toBe('Scrum Master');
    fireEvent.click(screen.getByRole('button', { name: 'Forget me' }));
    await waitFor(() => expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe(''));
    expect(device.store.loadIdentity()).toBeNull();
  });
});

describe('join screen', () => {
  it('a join link opens the join form with name and role', () => {
    renderApp(makeApp(new MemoryNetwork(), { hash: '#/join/SOMESESSIONID' }));
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    expect(screen.getByLabelText('Your role')).toBeTruthy();
    expect(screen.getByText(/invitation link/)).toBeTruthy();
  });

  it('empty fields block joining with messages', async () => {
    renderApp(makeApp(new MemoryNetwork(), { hash: '#/join/SOMESESSIONID' }));
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Please enter your name.')).toBeTruthy();
    fill('Your name', 'Alex');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText('Please enter your role.')).toBeTruthy();
  });

  it('an unknown code shows "session cannot be found"', async () => {
    renderApp(makeApp(new MemoryNetwork(), { hash: '#/join/ZZZZZZ' }));
    fill('Your name', 'Alex');
    fill('Your role', 'Dev');
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByText(/This session cannot be found/)).toBeTruthy();
  });

  it('joining an existing session lands in the lobby and the address bar no longer holds the session ID', async () => {
    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    const t = makeApp(net, { hash: '#/join/SESSION1' });
    renderApp(t);
    fill('Your name', 'Alex');
    fill('Your role', 'Developer');
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByText('Waiting for the Facilitator to start the session…');
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Fiona')).toBeTruthy();
    expect(t.router.hash).toBe('#/session');
    expect(t.device.store.loadIdentity()).toEqual({ name: 'Alex', role: 'Developer' });
    host.stop();
  });

  it('joining with the code works and a participant cannot start the session', async () => {
    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    renderApp(makeApp(net, { hash: '#/join/K7M4QX' }));
    fill('Your name', 'Alex');
    fill('Your role', 'Developer');
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByText('Waiting for the Facilitator to start the session…');
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
    host.stop();
  });
});

describe('two apps side by side (Facilitator and participant)', () => {
  it('the participant appears in the Facilitator lobby and both move into the session on Start', async () => {
    const net = new MemoryNetwork();
    const f = makeApp(net);
    const fView = render(<App controller={f.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    f.app.boot();
    chooseFormat(f.app);
    await f.app.createSession({ name: 'Fiona', role: 'Scrum Master' });
    const fq = within(fView.container as HTMLElement);
    await fq.findByRole('heading', { name: 'Lobby' });
    const code = (fq.getByLabelText('Join code') as HTMLInputElement).value;

    const p = makeApp(net, { hash: `#/join/${code}` });
    const pView = render(<App controller={p.app} />, {
      container: document.body.appendChild(document.createElement('div')),
    });
    p.app.boot();
    const pq = within(pView.container as HTMLElement);
    fireEvent.input(await pq.findByLabelText('Your name'), { target: { value: 'Alex' } });
    fireEvent.input(pq.getByLabelText('Your role'), { target: { value: 'Developer' } });
    fireEvent.submit(pView.container.querySelector('form')!);
    await pq.findByText('Waiting for the Facilitator to start the session…');
    await fq.findByText('Alex');
    expect(pq.queryByRole('button', { name: 'Start session' })).toBeNull();

    fireEvent.click(fq.getByRole('button', { name: 'Start session' }));
    await pq.findByRole('heading', { name: 'Session' });
    await fq.findByRole('heading', { name: 'Session' });
    f.app.endSession();
    void joinClient;
  });
});
