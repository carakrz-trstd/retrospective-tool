import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientFailure } from '../src/client/ClientController';
import { HostController } from '../src/host/HostController';
import { PROTOCOL_VERSION } from '../src/core/protocol';
import { registerIntentHandler, resetRegistries } from '../src/core/registry';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import type { Transport } from '../src/transport/Transport';
import { joinClient, makeDevice, rejoinClient, settle, startHost } from './sessionHelpers';

let net: MemoryNetwork;
const stoppers: (() => void)[] = [];

function track<T extends { stop(): void }>(x: T): T {
  stoppers.push(() => x.stop());
  return x;
}

function registerDemo() {
  registerIntentHandler('demo.note.add', ({ state, senderId, payload }) => {
    const p = payload as { id: string; text: string };
    const demo = (state.extensions.demo as { notes: Record<string, unknown> } | undefined) ?? { notes: {} };
    return {
      ok: true,
      state: {
        ...state,
        extensions: {
          ...state.extensions,
          demo: { notes: { ...demo.notes, [p.id]: { text: p.text, by: senderId } } },
        },
      },
    };
  });
}

beforeEach(() => {
  net = new MemoryNetwork();
});

afterEach(() => {
  for (const s of stoppers.splice(0)) s();
  resetRegistries();
  vi.useRealTimers();
});

describe('client: join', () => {
  it('joins with a session ID: gets a welcome, stores the participant record and the remembered identity', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client, device } = joinClient(net, 'SESSION1', 'Alex', 'Developer');
    track(client);
    await client.ready;
    const snap = client.snapshot;
    expect(snap.status).toBe('online');
    expect(snap.participantId).toBeTruthy();
    expect(
      Object.values(snap.state!.participants)
        .map((p) => p.displayName)
        .sort(),
    ).toEqual(['Alex', 'Fiona']);
    const record = device.store.loadParticipantRecord('SESSION1')!;
    expect(record).toMatchObject({ name: 'Alex', role: 'Developer', leftLocally: false });
    expect(record.token).toBeTruthy();
    expect(device.store.loadIdentity()).toEqual({ name: 'Alex', role: 'Developer' });
    expect(device.store.getActiveSession()).toBe('SESSION1');
  });

  it('joins with a join code: resolves the code first, then connects to the session', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, ' k7m4qx ', 'Alex');
    track(client);
    await client.ready;
    expect(client.snapshot.state!.sessionId).toBe('SESSION1');
  });

  it('an unknown code or session yields "session not found"', async () => {
    const { host } = await startHost(net);
    track(host);
    const byCode = joinClient(net, 'ZZZZZZ', 'Alex');
    await expect(byCode.client.ready).rejects.toMatchObject({ reason: 'session-not-found' });
    expect(byCode.client.snapshot.status).toBe('failed');
    const byId = joinClient(net, 'NOSUCHSESSIONIDNOSUCH', 'Alex');
    await expect(byId.client.ready).rejects.toBeInstanceOf(ClientFailure);
    expect(byId.client.snapshot.error).toBe('session-not-found');
  });

  it('joining an ended session fails with "session ended"', async () => {
    const { host } = await startHost(net);
    track(host);
    host.endSession();
    const { client } = joinClient(net, 'SESSION1', 'Late');
    await expect(client.ready).rejects.toMatchObject({ reason: 'session-ended' });
  });

  it('an empty name fails with a message and joins nothing', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client, device } = joinClient(net, 'SESSION1', '   ');
    await expect(client.ready).rejects.toMatchObject({ reason: 'name-required' });
    expect(device.store.loadParticipantRecord('SESSION1')).toBeNull();
  });

  it('a protocol version the host does not know yields an update message', async () => {
    const { host } = await startHost(net);
    track(host);
    // talk to the host with a wrong version by hand
    const t = new MemoryTransport(net);
    const conn = await t.connect('retro-s-SESSION1');
    const seen: { type: string; reason?: string }[] = [];
    conn.onMessage((m) => seen.push(m as { type: string; reason?: string }));
    conn.send({ v: PROTOCOL_VERSION + 5, type: 'join', name: 'A', role: 'B' });
    await settle();
    expect(seen.some((m) => m.type === 'rejected' && m.reason === 'version')).toBe(true);
  });
});

describe('client: reconnect and rejoin', () => {
  it('after a connection drop the client shows reconnecting, then rejoins as the same person without a duplicate', async () => {
    vi.useFakeTimers();
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await vi.advanceTimersByTimeAsync(0);
    await client.ready;
    const pid = client.snapshot.participantId;
    const statuses: string[] = [];
    client.onChange((s) => statuses.push(s.status));
    net.dropAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.snapshot.status).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(client.snapshot.status).toBe('online');
    expect(client.snapshot.participantId).toBe(pid);
    expect(Object.keys(host.data.state.participants)).toHaveLength(2);
    expect(statuses).toContain('reconnecting');
    expect(host.data.state.participants[pid!]!.presence).toBe('online');
  });

  it('a reloaded page rejoins from the stored record with the same token and keeps its entries', async () => {
    registerDemo();
    const { host } = await startHost(net);
    track(host);
    const first = joinClient(net, 'SESSION1', 'Alex');
    await first.client.ready;
    const pid = first.client.snapshot.participantId;
    first.client.sendIntent('demo.note.add', { id: 'n1', text: 'mine' });
    await settle();
    first.client.stop(); // the page is closed
    await settle();
    const again = track(rejoinClient(first.device, 'SESSION1'));
    expect(again.snapshot.status).toBe('reconnecting');
    expect(again.snapshot.state).not.toBeNull(); // last known state is shown at once
    await again.ready.catch(() => {});
    await vi.waitFor(() => expect(again.snapshot.status).toBe('online'));
    expect(again.snapshot.participantId).toBe(pid);
    expect(Object.keys(host.data.state.participants)).toHaveLength(2);
    const notes = (again.snapshot.state!.extensions.demo as { notes: Record<string, unknown> }).notes;
    expect(Object.keys(notes)).toEqual(['n1']);
  });

  it('an update with a gap in seq triggers a resync and the state converges', async () => {
    registerDemo();
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await client.ready;
    const other = joinClient(net, 'SESSION1', 'Blake');
    track(other.client);
    await other.client.ready;
    // make the client miss an update: drop one message by pausing delivery on its connection
    const transport = (client as unknown as { conn: { onMessage(cb: unknown): void } | null }).conn;
    expect(transport).not.toBeNull();
    // simulate the gap by changing the expected sequence number
    (client as unknown as { lastSeq: number }).lastSeq -= 5;
    host.applyLocalIntent('demo.note.add', { id: 'n1', text: 'one' });
    await settle();
    await vi.waitFor(() => {
      const demo = client.snapshot.state!.extensions.demo as { notes: Record<string, unknown> } | undefined;
      expect(Object.keys(demo?.notes ?? {})).toEqual(['n1']);
    });
  });

  it('ignores a duplicate update (seq not newer than the last one)', async () => {
    registerDemo();
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await client.ready;
    const rev = client.snapshot.state!.rev;
    (client as unknown as { onMessage(m: unknown): void }).onMessage({
      v: PROTOCOL_VERSION,
      type: 'update',
      hostTime: 1,
      seq: 0,
      rev: rev + 10,
      changes: [{ path: ['title'], value: 'sneaky' }],
    });
    expect(client.snapshot.state!.title).toBeUndefined();
  });
});

describe('client: facilitator offline and the outbox', () => {
  it('shows facilitator-offline, keeps the last state, stores intents in the outbox, and sends them once when the host is back', async () => {
    registerDemo();
    vi.useFakeTimers();
    const { host, device: hostDevice } = await startHost(net);
    const { client, device } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await vi.advanceTimersByTimeAsync(0);
    await client.ready;
    const lastState = client.snapshot.state;

    host.stop();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(client.snapshot.status).toBe('facilitator-offline');
    expect(client.snapshot.state).toEqual(lastState);

    client.sendIntent('demo.note.add', { id: 'n1', text: 'written while offline' }, 'op-1');
    client.sendIntent('demo.note.add', { id: 'n2', text: 'second' }, 'op-2');
    expect(client.snapshot.outbox.map((i) => i.opId)).toEqual(['op-1', 'op-2']);
    expect(device.store.loadParticipantRecord('SESSION1')!.outbox).toHaveLength(2);

    const record = hostDevice.store.loadHostRecord('SESSION1')!;
    const resumed = track(
      HostController.resume(record, { transport: new MemoryTransport(net), store: hostDevice.store }),
    );
    await vi.advanceTimersByTimeAsync(0);
    await resumed.ready;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.snapshot.status).toBe('online');
    const notes = (resumed.data.state.extensions.demo as { notes: Record<string, unknown> }).notes;
    expect(Object.keys(notes).sort()).toEqual(['n1', 'n2']);
    expect(client.snapshot.outbox).toEqual([]);
    expect(device.store.loadParticipantRecord('SESSION1')!.outbox).toEqual([]);
  });

  it('re-sending after a second drop causes no duplicates', async () => {
    registerDemo();
    vi.useFakeTimers();
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await vi.advanceTimersByTimeAsync(0);
    await client.ready;
    client.sendIntent('demo.note.add', { id: 'n1', text: 'once' }, 'op-1');
    await vi.advanceTimersByTimeAsync(10);
    const revAfter = host.data.state.rev;
    // the ack never arrived (as if lost): put the intent back in the outbox, then drop and rejoin
    (client as unknown as { outbox: unknown[] }).outbox = [
      { opId: 'op-1', kind: 'demo.note.add', payload: { id: 'n1', text: 'once' } },
    ];
    net.dropAll();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(client.snapshot.status).toBe('online');
    const notes = (host.data.state.extensions.demo as { notes: Record<string, unknown> }).notes;
    expect(Object.keys(notes)).toEqual(['n1']);
    expect(host.data.state.rev).toBeGreaterThanOrEqual(revAfter); // presence changed, but the note was applied once
    expect(client.snapshot.outbox).toEqual([]);
  });

  it('longOffline becomes true after exactly the hint time and false again after the host returns; the record is kept', async () => {
    vi.useFakeTimers();
    const { host, device: hostDevice } = await startHost(net);
    const { client, device } = joinClient(net, 'SESSION1', 'Alex', 'Dev', {
      hostOfflineHintMs: 15 * 60 * 1000,
    });
    track(client);
    await vi.advanceTimersByTimeAsync(0);
    await client.ready;
    let offlineSince = 0;
    client.onChange((s) => {
      if (s.status === 'facilitator-offline' && offlineSince === 0) offlineSince = Date.now();
    });
    host.stop();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_100); // first failed reconnect attempt: facilitator-offline begins
    expect(client.snapshot.status).toBe('facilitator-offline');
    expect(offlineSince).toBeGreaterThan(0);
    expect(client.snapshot.longOffline).toBe(false);
    // exactly 15 minutes after the status became facilitator-offline
    const remaining = offlineSince + 15 * 60 * 1000 - Date.now();
    await vi.advanceTimersByTimeAsync(remaining - 1);
    expect(client.snapshot.longOffline).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.snapshot.longOffline).toBe(true);
    expect(device.store.loadParticipantRecord('SESSION1')).not.toBeNull();

    const record = hostDevice.store.loadHostRecord('SESSION1')!;
    const resumed = track(
      HostController.resume(record, { transport: new MemoryTransport(net), store: hostDevice.store }),
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await resumed.ready;
    expect(client.snapshot.status).toBe('online');
    expect(client.snapshot.longOffline).toBe(false);
  });

  it('reconnect attempts follow the backoff 1, 2, 4, 8, 15, 15 seconds', async () => {
    vi.useFakeTimers();
    const { host } = await startHost(net);
    const attempts: number[] = [];
    const device = makeDevice(net);
    const real = device.transport;
    const spyTransport: Transport = {
      listen: (id, cb) => real.listen(id, cb),
      connect: (id) => {
        attempts.push(Date.now());
        return real.connect(id);
      },
      stop: () => real.stop(),
      onStatus: (cb) => real.onStatus(cb),
    };
    device.transport = spyTransport as MemoryTransport;
    const { client } = joinClient(net, 'SESSION1', 'Alex', 'Dev', {}, device);
    track(client);
    await vi.advanceTimersByTimeAsync(0);
    await client.ready;
    attempts.length = 0;
    host.stop();
    await vi.advanceTimersByTimeAsync(0);
    const start = Date.now();
    await vi.advanceTimersByTimeAsync(60_000);
    const gaps = attempts.slice(1).map((t, i) => t - attempts[i]!);
    expect(attempts.length).toBeGreaterThanOrEqual(6);
    expect(gaps.slice(0, 5)).toEqual([2_000, 4_000, 8_000, 15_000, 15_000]);
    expect(attempts[0]! - start).toBe(1_000);
  });
});

describe('client: leave, removal, end', () => {
  it('"Leave session" stops reconnecting, keeps the record, and a later rejoin brings the participant back online', async () => {
    const { host } = await startHost(net);
    track(host);
    const first = joinClient(net, 'SESSION1', 'Alex');
    await first.client.ready;
    const pid = first.client.snapshot.participantId!;
    first.client.leave();
    await settle();
    expect(first.client.snapshot.status).toBe('left');
    expect(first.device.store.loadParticipantRecord('SESSION1')).toMatchObject({ leftLocally: true });
    expect(host.data.state.participants[pid]!.presence).toBe('offline');
    expect(host.data.state.participants[pid]!.status).toBe('active'); // stays in the list as offline

    const again = track(rejoinClient(first.device, 'SESSION1'));
    await vi.waitFor(() => expect(again.snapshot.status).toBe('online'));
    expect(again.snapshot.participantId).toBe(pid);
    expect(host.data.state.participants[pid]!.presence).toBe('online');
    expect(first.device.store.loadParticipantRecord('SESSION1')).toMatchObject({ leftLocally: false });
  });

  it('removal clears the participant record and shows the removal; a later rejoin is rejected', async () => {
    const { host } = await startHost(net);
    track(host);
    const first = joinClient(net, 'SESSION1', 'Alex');
    await first.client.ready;
    const pid = first.client.snapshot.participantId!;
    const record = first.device.store.loadParticipantRecord('SESSION1')!;
    host.removeParticipant(pid);
    await settle();
    expect(first.client.snapshot.status).toBe('removed');
    expect(first.device.store.loadParticipantRecord('SESSION1')).toBeNull();
    // somebody tries to come back with the old token
    first.device.store.saveParticipantRecord('SESSION1', record);
    const again = track(rejoinClient(first.device, 'SESSION1'));
    await vi.waitFor(() => expect(again.snapshot.status).toBe('removed'));
  });

  it('end: shows the ended state, notifies listeners and does not reconnect', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await client.ready;
    const ended = vi.fn();
    client.onEnded(ended);
    host.endSession();
    await settle();
    expect(client.snapshot.status).toBe('ended');
    expect(client.snapshot.state!.status).toBe('ended');
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('keeps the intents the host refuses and tells the person why', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    await client.ready;
    client.sendIntent('nope.nothing', {}, 'op-9');
    await settle();
    expect(client.snapshot.outbox).toEqual([]);
    expect(client.snapshot.rejectedOps).toEqual([
      { opId: 'op-9', kind: 'nope.nothing', reason: 'unknown-intent' },
    ]);
  });

  it('passes the host time of every message to the clock listeners', async () => {
    const { host } = await startHost(net);
    track(host);
    const { client } = joinClient(net, 'SESSION1', 'Alex');
    track(client);
    const times: number[] = [];
    client.onHostTime((t) => times.push(t));
    await client.ready;
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((t) => typeof t === 'number' && t > 0)).toBe(true);
  });
});
