import { afterEach, describe, expect, it } from 'vitest';
import { HostController } from '../../src/host/HostController';
import { getFlow } from '../../src/flow/flowState';
import { remaining } from '../../src/flow/timer';
import { suggestedMs } from '../../src/flow/suggested';
import { MemoryNetwork, MemoryTransport } from '../../src/transport/MemoryTransport';
import { testFormat } from '../helpers';
import { cleanup, flowSetup, T0 } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

describe('flow intents: resume after a host restart', () => {
  it('stop, timers, reveal flags and mute-all are restored and a running timer keeps its start time', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    s.intent('flow.muteAll', { muted: true });
    s.clock.now = T0 + 1_000;
    s.intent('flow.timer', { action: 'start' }); // at retro.reveal
    const saved = structuredClone(s.host.data);
    s.host.stop();

    const resumed = HostController.resume(saved, {
      transport: new MemoryTransport(new MemoryNetwork()),
      store: s.store,
      now: () => s.clock.now,
    });
    hosts.push(resumed);
    await resumed.ready;
    const flow = getFlow(resumed.data.state);
    expect(flow.stop).toBe('retro.reveal');
    expect(flow.revealed.retro).toBe(true);
    expect(flow.soundMutedForAll).toBe(true);
    expect(flow.timers['retro.reveal']!.startedAt).toBe(T0 + 1_000);
    const duration = suggestedMs('retro.reveal', testFormat, 50);
    expect(remaining(flow.timers['retro.reveal']!, duration, T0 + 61_000)).toBe(duration - 60_000);
  });
});
