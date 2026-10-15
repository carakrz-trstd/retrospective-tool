import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerContrib } from '../../src/contrib/register';
import { overlayState } from '../../src/contrib/overlay';
import { getContrib, getContribView } from '../../src/contrib/types';
import { resetRegistries } from '../../src/core/registry';
import { resetFlowRegistries } from '../../src/flow/registries';
import { HostController } from '../../src/host/HostController';
import { MemoryNetwork, MemoryTransport } from '../../src/transport/MemoryTransport';
import { joinClient, rejoinClient, startHost } from '../sessionHelpers';

let net: MemoryNetwork;
const stoppers: (() => void)[] = [];
const track = <T extends { stop(): void }>(x: T): T => {
  stoppers.push(() => x.stop());
  return x;
};

beforeEach(() => {
  net = new MemoryNetwork();
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
  vi.useFakeTimers();
});
afterEach(() => {
  for (const s of stoppers.splice(0)) s();
  resetRegistries();
  resetFlowRegistries();
  vi.useRealTimers();
});

const retro = (id: string, text: string) => ({ id, kind: 'retro', columnId: 'a', text });

describe('writing while the Facilitator is offline (AC-14, AC-20)', () => {
  it('own entries stay visible, survive a reload, and arrive once when the host is back', async () => {
    const { host, device: hostDevice } = await startHost(net);
    host.startSession();
    const a = joinClient(net, 'SESSION1', 'Alex');
    const b = joinClient(net, 'SESSION1', 'Blake');
    track(a.client);
    track(b.client);
    await vi.advanceTimersByTimeAsync(0);
    await a.client.ready;
    await b.client.ready;
    await vi.advanceTimersByTimeAsync(0);

    host.stop();
    await vi.advanceTimersByTimeAsync(1_100);
    expect(a.client.snapshot.status).toBe('facilitator-offline');

    a.client.sendIntent('entry.add', retro('e1', 'first'), 'op-1');
    a.client.sendIntent('entry.add', retro('e2', 'second'), 'op-2');
    a.client.sendIntent('entry.edit', { id: 'e1', text: 'first, edited' }, 'op-3');

    const me = { participantId: a.client.snapshot.participantId!, isFacilitator: false };
    const shown = (c: typeof a.client) =>
      getContribView(overlayState(c.snapshot.state, c.snapshot.outbox, me, Date.now())!).entries;
    expect(Object.keys(shown(a.client)).sort()).toEqual(['e1', 'e2']);
    expect(shown(a.client).e1!.text).toBe('first, edited');

    // the page is reloaded: the same entries are shown from the stored record
    a.client.stop();
    const again = track(rejoinClient(a.device, 'SESSION1'));
    expect(again.snapshot.outbox).toHaveLength(3);
    expect(Object.keys(shown(again)).sort()).toEqual(['e1', 'e2']);

    // the Facilitator returns from its saved record
    const record = hostDevice.store.loadHostRecord('SESSION1')!;
    const resumed = track(
      HostController.resume(record, { transport: new MemoryTransport(net), store: hostDevice.store }),
    );
    await vi.advanceTimersByTimeAsync(0);
    await resumed.ready;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(again.snapshot.status).toBe('online');
    expect(again.snapshot.outbox).toEqual([]);
    const stored = getContrib(resumed.data.state).entries;
    expect(Object.keys(stored).sort()).toEqual(['e1', 'e2']);
    expect(stored.e1!.text).toBe('first, edited');

    // after the reveal everybody sees each entry exactly once
    resumed.applyLocalIntent('flow.goto', { stop: 'retro.write' }, 'g1');
    resumed.applyLocalIntent('flow.reveal', { key: 'retro' }, 'g2');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(Object.keys(shown(b.client)).sort()).toEqual(['e1', 'e2']);
    expect(Object.keys(shown(again)).sort()).toEqual(['e1', 'e2']);
  });
});
