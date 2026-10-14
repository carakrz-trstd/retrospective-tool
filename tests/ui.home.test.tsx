import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { Store } from '../src/storage/storage';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { makeApp, renderApp } from './appHelpers';
import { makeHostData } from './helpers';
import { makeDevice } from './sessionHelpers';
import { MemoryStorage, ThrowingStorage } from './storageFakes';

afterEach(() => cleanup());

describe('home screen', () => {
  it('shows create and join and the internal-use notice', () => {
    renderApp(makeApp(new MemoryNetwork()));
    expect(screen.getByRole('button', { name: 'Create session' })).toBeTruthy();
    expect(screen.getByLabelText('Join code or link')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
    expect(screen.getByText(/internal use only/i)).toBeTruthy();
  });

  it('offers "Resume session" only when a host record exists', async () => {
    const net = new MemoryNetwork();
    const device = makeDevice(net);
    renderApp(makeApp(net, { device }));
    expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull();
    cleanup();

    device.store.saveHostRecord(makeHostData());
    renderApp(makeApp(net, { device }));
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeTruthy();
  });

  it('offers "Rejoin session" when participant records exist', () => {
    const net = new MemoryNetwork();
    const device = makeDevice(net);
    device.store.saveParticipantRecord('S1', {
      token: 't',
      participantId: 'p',
      name: 'Alex',
      role: 'Dev',
      lastState: null,
      lastSeq: 0,
      outbox: [],
      leftLocally: false,
    });
    renderApp(makeApp(net, { device }));
    expect(screen.getByRole('button', { name: 'Rejoin session' })).toBeTruthy();
  });

  it('removing a stored session from this device deletes it', async () => {
    const net = new MemoryNetwork();
    const device = makeDevice(net);
    device.store.saveHostRecord(makeHostData());
    renderApp(makeApp(net, { device }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this device' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull());
    expect(device.store.listIndex()).toEqual([]);
  });

  it('tells people when the browser cannot save data', () => {
    const net = new MemoryNetwork();
    const device = makeDevice(net);
    device.store = new Store({ local: new ThrowingStorage(), session: new MemoryStorage() });
    renderApp(makeApp(net, { device }));
    expect(screen.getByText(/does not allow saving data/i)).toBeTruthy();
  });

  it('the join form opens the join screen with the typed code', async () => {
    renderApp(makeApp(new MemoryNetwork()));
    fireEvent.input(screen.getByLabelText('Join code or link'), { target: { value: 'K7M4QX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await screen.findByText(/Join code: K7M4QX/);
    expect(screen.getByLabelText('Your name')).toBeTruthy();
  });
});
