import { afterEach, describe, expect, it } from 'vitest';
import { viewFor } from '../../src/core/view';
import { registerFakeContributions } from '../../e2e/fixtures/fakeContributions';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

type FakeSlice = { entries: Record<string, { by: string; text: string }> };
const entriesOf = (state: ReturnType<typeof viewFor>) =>
  Object.values(((state.extensions.fake as FakeSlice | undefined)?.entries ?? {}) as FakeSlice['entries']);

// The fixture stands in for Epic 4 in the e2e build, so its contract with Epic 3 is tested here.
describe('fake contributions fixture', () => {
  it('hides entries of others until the phase is revealed, counts authors, and shows late entries at once', async () => {
    const s = await flowSetup({ clients: ['Alex', 'Blake'], start: false });
    hosts.push(s.host);
    registerFakeContributions();
    s.host.startSession();
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    s.intent('flow.goto', { stop: 'retro.write' });

    await alex.intent('fake.add', { text: 'from Alex' }, 'a1');
    await blake.intent('fake.add', { text: 'from Blake' }, 'b1');
    expect(entriesOf(viewFor(s.state(), alex.participantId!)).map((e) => e.text)).toEqual(['from Alex']);
    expect(entriesOf(viewFor(s.state(), s.host.facilitatorId))).toHaveLength(0);
    const counts = (viewFor(s.state(), s.host.facilitatorId).extensions.flow as { counts: unknown }).counts;
    expect(counts).toMatchObject({ retro: { added: 2, total: 3 } });

    s.intent('flow.reveal', { key: 'retro' });
    expect(
      entriesOf(viewFor(s.state(), alex.participantId!))
        .map((e) => e.text)
        .sort(),
    ).toEqual(['from Alex', 'from Blake']);
    // a late entry after the reveal is visible to everybody immediately (AC-25)
    await blake.intent('fake.add', { text: 'late' }, 'b2');
    expect(entriesOf(viewFor(s.state(), alex.participantId!)).map((e) => e.text)).toContain('late');
  });

  it('refuses entries outside the check-in and retro stops', async () => {
    const s = await flowSetup({ clients: ['Alex'], start: false });
    hosts.push(s.host);
    registerFakeContributions();
    s.host.startSession();
    s.intent('flow.goto', { stop: 'notes' });
    expect(s.host.applyLocalIntent('fake.add', { text: 'x' }, 'f1').ok).toBe(false);
  });
});
