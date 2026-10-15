import { afterEach, describe, expect, it } from 'vitest';
import { getContribView } from '../../src/contrib/types';
import type { HostController } from '../../src/host/HostController';
import { RawClient, flush } from '../hostHelpers';
import { cleanup, contribSetup } from './contribSetup';

const hosts: HostController[] = [];
afterEach(() => cleanup(hosts.splice(0)));

const retro = (id: string, text = 'x') => ({ id, kind: 'retro', columnId: 'a', text });
const entryIds = (c: RawClient) => Object.keys(getContribView(c.state!).entries).sort();
const updates = (c: RawClient) => c.ofType('update');

type Change = { path: string[]; value: unknown };

describe('contributions over the real host and clients (AC-3, AC-5, AC-13, AC-14, AC-20)', () => {
  it('an entry added by A reaches only A until the reveal', async () => {
    const s = await contribSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    await alex.intent('entry.add', retro('e1', 'secret of Alex'), 'a1');
    expect(entryIds(alex)).toEqual(['e1']);
    expect(entryIds(blake)).toEqual([]);
    expect(JSON.stringify(blake.messages)).not.toContain('secret of Alex');
    expect(Object.keys(getContribView(s.host.view()).entries)).toEqual([]); // not even the Facilitator
  });

  it('the reveal reaches B as one update with item-level changes for all revealed entries', async () => {
    const s = await contribSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    await alex.intent('entry.add', retro('e1'), 'a1');
    await alex.intent('entry.add', retro('e2'), 'a2');
    await blake.intent('entry.add', retro('e3'), 'b1');
    const before = updates(blake).length;
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await flush();
    const got = updates(blake).slice(before);
    const entryChanges = got.flatMap((u) => u.changes as Change[]).filter((c) => c.path[2] === 'entries');
    expect(entryChanges.map((c) => c.path[3]).sort()).toEqual(['e1', 'e2']);
    expect(entryIds(blake)).toEqual(['e1', 'e2', 'e3']);
    expect(entryIds(alex)).toEqual(['e1', 'e2', 'e3']);
  });

  it('after the reveal a new entry reaches everybody; a hidden entry causes no update for others', async () => {
    const s = await contribSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    const quiet = updates(blake).length;
    await alex.intent('entry.add', retro('hidden'), 'a0');
    expect(updates(blake).length).toBe(quiet); // nothing visible changed for B
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await flush();
    await alex.intent('entry.add', retro('late', 'late one'), 'a1');
    expect(entryIds(blake)).toContain('late');
    expect(getContribView(s.host.view()).entries.late!.text).toBe('late one');
  });

  it('an entry deleted by the Facilitator is a deletion change for everybody who had it', async () => {
    const s = await contribSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    await alex.intent('entry.add', retro('e1'), 'a1');
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await flush();
    expect(entryIds(blake)).toEqual(['e1']);
    const before = updates(blake).length;
    expect(s.host.applyLocalIntent('entry.delete', { id: 'e1' }, 'del-1').ok).toBe(true);
    await flush();
    const changes = updates(blake)
      .slice(before)
      .flatMap((u) => u.changes as Change[]);
    expect(changes).toContainEqual({ path: ['extensions', 'contrib', 'entries', 'e1'], value: null });
    expect(entryIds(blake)).toEqual([]);
    expect(entryIds(alex)).toEqual([]);
  });

  it("a removed participant's entries disappear from every view but stay stored on the host", async () => {
    const s = await contribSetup({ clients: ['Alex', 'Blake'] });
    hosts.push(s.host);
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    await blake.intent('entry.add', retro('eb', 'blake entry'), 'b1');
    await alex.intent('entry.add', retro('ea', 'alex entry'), 'a1');
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await flush();
    expect(entryIds(alex)).toEqual(['ea', 'eb']);
    s.host.removeParticipant(blake.participantId!);
    await flush();
    expect(entryIds(alex)).toEqual(['ea']);
    expect(Object.keys(getContribView(s.host.view()).entries)).toEqual(['ea']);
    const stored = s.host.data.state.extensions.contrib as { entries: Record<string, unknown> };
    expect(Object.keys(stored.entries).sort()).toEqual(['ea', 'eb']);
  });

  it('a client that joins after the reveal gets the revealed entries in its first snapshot', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    await s.clients.Alex!.intent('entry.add', retro('e1'), 'a1');
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await flush();
    const late = await new RawClient(s.net).connect('SESSION1');
    await late.join('Late');
    expect(Object.keys(getContribView(late.ofType('welcome')[0]!.state).entries)).toEqual(['e1']);
  });

  it('the same intent re-sent after a drop does not create a duplicate (AC-20)', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    const alex = s.clients.Alex!;
    await alex.intent('entry.add', retro('e1'), 'op-same');
    await alex.intent('entry.add', retro('e1'), 'op-same'); // re-sent with the same opId
    await alex.intent('entry.add', retro('e1'), 'op-other'); // re-sent with a new opId, same item ID
    expect(entryIds(alex)).toEqual(['e1']);
    const stored = s.host.data.state.extensions.contrib as { entries: Record<string, unknown> };
    expect(Object.keys(stored.entries)).toEqual(['e1']);
  });

  it('a participant cannot make the Facilitator-only changes through the host', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    const alex = s.clients.Alex!;
    await alex.intent('note.add', { id: 'n1', text: 'note' }, 'a1');
    await alex.intent('note.delete', { id: 'n1' }, 'a2');
    await alex.intent('survey.close', {}, 'a3');
    await flush();
    const stored = s.host.data.state.extensions.contrib as {
      notes: Record<string, unknown>;
      survey: { closed: boolean };
    };
    expect(Object.keys(stored.notes)).toEqual(['n1']);
    expect(stored.survey.closed).toBe(false);
    expect(alex.ofType('rejected').map((r) => r.reason)).toEqual(['not-facilitator', 'not-facilitator']);
  });
});
