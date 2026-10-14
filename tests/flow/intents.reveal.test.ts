import { afterEach, describe, expect, it } from 'vitest';
import { isRevealed } from '../../src/flow/flowView';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

describe('flow intents: reveal', () => {
  it("key 'checkIn' works only in the check-in stop", async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'notes' });
    expect(s.intent('flow.reveal', { key: 'checkIn' }).ok).toBe(false);
    s.intent('flow.goto', { stop: 'checkIn' });
    expect(s.intent('flow.reveal', { key: 'checkIn' }).ok).toBe(true);
    expect(s.flow().revealed.checkIn).toBe(true);
    expect(s.flow().stop).toBe('checkIn');
    expect(isRevealed(s.state(), 'checkIn')).toBe(true);
    expect(isRevealed(s.state(), 'retro')).toBe(false);
  });

  it("key 'retro' works only in a retro stop and moves write to reveal", async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    expect(s.intent('flow.reveal', { key: 'retro' }).ok).toBe(false);
    s.intent('flow.goto', { stop: 'retro.write' });
    expect(s.intent('flow.reveal', { key: 'retro' }).ok).toBe(true);
    expect(s.flow().revealed.retro).toBe(true);
    expect(s.flow().stop).toBe('retro.reveal');
  });

  it('revealing twice is a no-op', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    const before = structuredClone(s.flow());
    expect(s.intent('flow.reveal', { key: 'retro' }).ok).toBe(true);
    expect(s.flow()).toEqual(before);
  });

  it('the flag stays true after going back to retro.write', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    s.intent('flow.prev');
    expect(s.flow().stop).toBe('retro.write');
    expect(isRevealed(s.state(), 'retro')).toBe(true);
  });
});
