import { afterEach, describe, expect, it } from 'vitest';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

describe('flow intents: mute for everybody', () => {
  it('flow.muteAll sets and clears soundMutedForAll', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    expect(s.flow().soundMutedForAll).toBe(false);
    expect(s.intent('flow.muteAll', { muted: true }).ok).toBe(true);
    expect(s.flow().soundMutedForAll).toBe(true);
    s.intent('flow.muteAll', { muted: false });
    expect(s.flow().soundMutedForAll).toBe(false);
  });
});
