import { afterEach, describe, expect, it } from 'vitest';
import { viewFor } from '../../src/core/view';
import { registerContributionCounter } from '../../src/flow/registries';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

type WithCounts = { counts?: Record<string, { added: number; total: number }> };

describe('flow view filter (AC-14, AC-17)', () => {
  it("the Facilitator's view contains counts from the registered counters; participants never get counts", async () => {
    const s = await flowSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    registerContributionCounter('retro', (state) => ({
      added: 1,
      total: Object.keys(state.participants).length,
    }));
    registerContributionCounter('checkIn', () => ({ added: 2, total: 3 }));
    const state = s.state();
    const fac = viewFor(state, s.host.facilitatorId).extensions.flow as WithCounts;
    expect(fac.counts).toEqual({ retro: { added: 1, total: 3 }, checkIn: { added: 2, total: 3 } });
    for (const c of Object.values(s.clients)) {
      const v = viewFor(state, c.participantId!).extensions.flow as WithCounts | undefined;
      expect(v?.counts).toBeUndefined();
    }
    // the stored state never holds counts
    expect((state.extensions.flow as WithCounts | undefined)?.counts).toBeUndefined();
  });

  it('the counter receives the full state but only { added, total } reaches the view', async () => {
    const s = await flowSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    s.host.data.state.extensions.fake = { entries: { e1: { by: 'someone', text: 'SECRET' } } };
    let seen: unknown;
    registerContributionCounter('retro', (state) => {
      seen = state.extensions.fake;
      return { added: 1, total: 2, names: ['x'], text: 'SECRET' } as never;
    });
    const fac = viewFor(s.state(), s.host.facilitatorId);
    expect(JSON.stringify(seen)).toContain('SECRET');
    const counts = (fac.extensions.flow as WithCounts).counts!;
    expect(counts.retro).toEqual({ added: 1, total: 2 });
    expect(Object.keys(counts.retro!).sort()).toEqual(['added', 'total']);
    expect(JSON.stringify(fac.extensions.flow)).not.toMatch(/SECRET|names/);
  });

  it('without a registered counter the counts are { added: 0, total: n }', async () => {
    const s = await flowSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const fac = viewFor(s.state(), s.host.facilitatorId).extensions.flow as WithCounts;
    expect(fac.counts).toEqual({ checkIn: { added: 0, total: 3 }, retro: { added: 0, total: 3 } });
  });
});
