import { afterEach, describe, expect, it } from 'vitest';
import { registerViewFilter } from '../../src/core/registry';
import { isRevealed } from '../../src/flow/flowView';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

/** Stands in for Epic 4: hides other people's retro entries until they are revealed. */
function registerFakeContributionFilter() {
  registerViewFilter((state, participantId) => {
    const fake = state.extensions.fake as
      { entries?: Record<string, { by: string; text: string }> } | undefined;
    if (!fake?.entries || isRevealed(state, 'retro')) return state;
    const mine = Object.fromEntries(Object.entries(fake.entries).filter(([, e]) => e.by === participantId));
    return { ...state, extensions: { ...state.extensions, fake: { entries: mine } } };
  });
}

describe('flow.next and flow.goto and the reveal flag (AD-16)', () => {
  it('flow.next from retro.write sets revealed.retro and lands on retro.reveal', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.write' });
    expect(s.flow().revealed.retro).toBe(false);
    s.intent('flow.next');
    expect(s.flow().stop).toBe('retro.reveal');
    expect(s.flow().revealed.retro).toBe(true);
  });

  it('flow.goto retro.discuss from checkIn also sets revealed.retro', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.discuss' });
    expect(s.flow().revealed.retro).toBe(true);
  });

  it('flow.next from checkIn to reviewActions does not set any reveal flag', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.next');
    expect(s.flow().revealed).toEqual({ checkIn: false, retro: false });
  });

  it('going back to retro.write keeps revealed.retro true; arriving at retro.write changes no flag', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.write' });
    expect(s.flow().revealed.retro).toBe(false);
    s.intent('flow.next');
    s.intent('flow.prev');
    expect(s.flow().stop).toBe('retro.write');
    expect(s.flow().revealed.retro).toBe(true);
  });

  it("a participant's view built after flow.next includes everybody's retro entries", async () => {
    const s = await flowSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    registerFakeContributionFilter();
    const [alexId, blakeId] = [s.clients.Alex!.participantId!, s.clients.Blake!.participantId!];
    // put two entries straight into the state (what Epic 4 will do through its own intents)
    const data = s.host.data;
    data.state.extensions.fake = {
      entries: { e1: { by: alexId, text: 'mine' }, e2: { by: blakeId, text: 'theirs' } },
    };
    s.intent('flow.goto', { stop: 'retro.write' });
    const { viewFor } = await import('../../src/core/view');
    const before = viewFor(s.state(), alexId).extensions.fake as { entries: Record<string, unknown> };
    expect(Object.keys(before.entries)).toEqual(['e1']);
    s.intent('flow.next');
    const after = viewFor(s.state(), alexId).extensions.fake as { entries: Record<string, unknown> };
    expect(Object.keys(after.entries).sort()).toEqual(['e1', 'e2']);
  });
});
