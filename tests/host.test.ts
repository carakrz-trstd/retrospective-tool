import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostController } from '../src/host/HostController';
import { PROTOCOL_VERSION } from '../src/core/protocol';
import { resolverPeerId } from '../src/core/peerIds';
import { registerIntentHandler, registerViewFilter, resetRegistries } from '../src/core/registry';
import type { SessionState } from '../src/core/types';
import { Store } from '../src/storage/storage';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import { testFormat } from './helpers';
import { RawClient, flush } from './hostHelpers';
import { MemoryStorage } from './storageFakes';

let net: MemoryNetwork;
let store: Store;
let local: MemoryStorage;
let hosts: HostController[] = [];

function makeStore() {
  local = new MemoryStorage();
  store = new Store({ local, session: new MemoryStorage(), now: () => Date.now(), expiryMs: 86_400_000 });
}

async function newHost(over: { joinCode?: string; sessionId?: string } = {}) {
  const host = HostController.create(
    {
      name: 'Fiona',
      role: 'Scrum Master',
      format: testFormat,
      timeBudgetMin: 50,
      sessionId: over.sessionId ?? 'SESSION1',
      joinCode: over.joinCode,
    },
    { transport: new MemoryTransport(net), store },
  );
  hosts.push(host);
  await host.ready;
  return host;
}

// A small test extension: demo.note.add stores notes under extensions.demo.notes.
function registerDemoIntents() {
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
  makeStore();
  hosts = [];
});

afterEach(() => {
  for (const h of hosts) h.stop();
  resetRegistries();
  vi.useRealTimers();
});

describe('host: joining', () => {
  it('three clients join, each gets a welcome with its own token, and everybody sees the lobby update', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    const c = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    await c.join('Casey');
    const tokens = new Set([a.token, b.token, c.token]);
    expect(tokens.size).toBe(3);
    expect(a.ofType('welcome')).toHaveLength(1);
    for (const client of [a, b, c]) {
      const names = Object.values(client.state!.participants)
        .map((p) => p.displayName)
        .sort();
      expect(names).toEqual(['Alex', 'Blake', 'Casey', 'Fiona']);
    }
    expect(Object.keys(host.data.state.participants)).toHaveLength(4);
  });

  it('every state sent comes from the view filter, never the raw host state', async () => {
    registerViewFilter((s) => ({ ...s, extensions: { ...s.extensions, viewed: true } }));
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    // the filter's mark is part of the welcome snapshot and (as it never changes) of no update
    expect((a.ofType('welcome')[0]!.state.extensions as { viewed?: boolean }).viewed).toBe(true);
    expect((b.ofType('welcome')[0]!.state.extensions as { viewed?: boolean }).viewed).toBe(true);
    expect(JSON.stringify(a.state)).toContain('"viewed":true');
  });

  it('sends the current state to a client that joins a running session (late join)', async () => {
    const host = await newHost();
    host.startSession();
    const late = await new RawClient(net).connect('SESSION1');
    await late.join('Late');
    expect(late.ofType('welcome')[0]!.state.status).toBe('running');
  });

  it('answers invalid joins with a rejection and keeps the connection usable', async () => {
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('', 'Dev');
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('name-required');
    await a.join('Alex', 'Dev');
    expect(a.state).not.toBeNull();
  });

  it('rejects a new participant joining an ended session', async () => {
    const host = await newHost();
    host.endSession();
    const late = await new RawClient(net).connect('SESSION1');
    await late.join('Late');
    expect(late.ofType('rejected').map((m) => m.reason)).toContain('session-ended');
    expect(late.state).toBeNull();
  });

  it('does not send other participants a snapshot when somebody leaves, but marks them offline', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    b.close();
    await flush();
    expect(a.state!.participants[b.participantId!]!.presence).toBe('offline');
    expect(host.data.state.participants[b.participantId!]!.presence).toBe('offline');
  });
});

describe('host: intents', () => {
  it('applies an intent from a valid participant once and answers with an ack', async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('demo.note.add', { id: 'n1', text: 'hello' }, 'op-1');
    expect(a.ofType('ack').map((m) => m.opId)).toEqual(['op-1']);
    const demo = host.data.state.extensions.demo as { notes: Record<string, { by: string }> };
    expect(Object.keys(demo.notes)).toEqual(['n1']);
    expect(demo.notes.n1!.by).toBe(a.participantId);
  });

  it('applies the same opId only once and acknowledges it twice', async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('demo.note.add', { id: 'n1', text: 'hello' }, 'op-1');
    const revAfterFirst = host.data.state.rev;
    await a.intent('demo.note.add', { id: 'n1', text: 'hello again' }, 'op-1');
    expect(a.ofType('ack').filter((m) => m.opId === 'op-1')).toHaveLength(2);
    expect(host.data.state.rev).toBe(revAfterFirst);
    const demo = host.data.state.extensions.demo as { notes: Record<string, { text: string }> };
    expect(demo.notes.n1!.text).toBe('hello');
  });

  it('rejects an intent from a connection that did not join or rejoin', async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.intent('demo.note.add', { id: 'n1', text: 'x' }, 'op-1');
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('not-joined');
    expect(host.data.state.extensions.demo).toBeUndefined();
  });

  it('rejects unknown intent types', async () => {
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('nope.nothing', {}, 'op-1');
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('unknown-intent');
  });

  it('rejects an unknown token and a removed token on rejoin', async () => {
    const host = await newHost();
    const unknown = await new RawClient(net).connect('SESSION1');
    await unknown.rejoin('not-a-token');
    expect(unknown.ofType('rejected').map((m) => m.reason)).toContain('unknown-token');

    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    host.removeParticipant(a.participantId!);
    await flush();
    const again = await new RawClient(net).connect('SESSION1');
    await again.rejoin(a.token!);
    expect(again.ofType('rejected').map((m) => m.reason)).toContain('removed');
  });

  it('answers an unknown protocol version with a version rejection', async () => {
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    a.send({ v: PROTOCOL_VERSION + 1, type: 'join', name: 'Alex', role: 'Dev' });
    await flush();
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('version');
  });

  it('lets only the Facilitator start the session: a participant start intent is rejected', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('session.start', {}, 'op-1');
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('not-facilitator');
    expect(host.data.state.status).toBe('lobby');
    host.startSession();
    await flush();
    expect(a.state!.status).toBe('running');
  });

  it('lets only the Facilitator remove or end: participant intents are rejected', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    await a.intent('session.remove', { participantId: b.participantId }, 'op-1');
    await a.intent('session.end', {}, 'op-2');
    expect(a.ofType('rejected').filter((m) => m.reason === 'not-facilitator')).toHaveLength(2);
    expect(host.data.state.participants[b.participantId!]!.status).toBe('active');
    expect(host.data.state.status).toBe('lobby');
  });

  it('removing a participant sends them a removal message and disconnects them', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    host.removeParticipant(b.participantId!);
    await flush();
    expect(b.ofType('removed')).toHaveLength(1);
    expect(b.closed).toBe(true);
    expect(a.state!.participants[b.participantId!]).toBeUndefined();
    expect(host.data.removedTokens).toContain(b.token);
  });

  it('end tells every connected participant and then no changes are possible', async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    host.endSession();
    await flush();
    expect(a.ofType('ended')).toHaveLength(1);
    expect(a.state!.status).toBe('ended');
    await a.intent('demo.note.add', { id: 'n1', text: 'late' }, 'op-1');
    expect(a.ofType('rejected').map((m) => m.reason)).toContain('session-ended');
  });

  it("applies the Facilitator's own local intents like any other and broadcasts them", async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    host.applyLocalIntent('demo.note.add', { id: 'n9', text: 'from the Facilitator' });
    await flush();
    const demo = a.state!.extensions.demo as { notes: Record<string, { text: string }> };
    expect(demo.notes.n9!.text).toBe('from the Facilitator');
  });
});

describe('host: sync', () => {
  it('each recipient receives consecutive seq values even when the view filter hides changes from them', async () => {
    registerDemoIntents();
    // hide notes written by somebody else
    registerViewFilter((s, pid) => {
      const demo = s.extensions.demo as { notes: Record<string, { by: string }> } | undefined;
      if (!demo) return s;
      const notes = Object.fromEntries(Object.entries(demo.notes).filter(([, n]) => n.by === pid));
      return { ...s, extensions: { ...s.extensions, demo: { notes } } };
    });
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    await a.intent('demo.note.add', { id: 'a1', text: 'a secret' }, 'o1');
    await a.intent('demo.note.add', { id: 'a2', text: 'another' }, 'o2');
    await b.intent('demo.note.add', { id: 'b1', text: 'mine' }, 'o3');
    expect(a.gaps).toBe(0);
    expect(b.gaps).toBe(0);
    const bNotes = (b.state!.extensions.demo as { notes: Record<string, unknown> }).notes;
    expect(Object.keys(bNotes)).toEqual(['b1']);
    const aNotes = (a.state!.extensions.demo as { notes: Record<string, unknown> }).notes;
    expect(Object.keys(aNotes).sort()).toEqual(['a1', 'a2']);
  });

  it('sends no update at all when a change is not visible to the recipient', async () => {
    registerDemoIntents();
    registerViewFilter((s, pid) => {
      const demo = s.extensions.demo as { notes: Record<string, { by: string }> } | undefined;
      if (!demo) return s;
      return {
        ...s,
        extensions: {
          ...s.extensions,
          demo: { notes: Object.fromEntries(Object.entries(demo.notes).filter(([, n]) => n.by === pid)) },
        },
      };
    });
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    const before = b.ofType('update').length;
    await a.intent('demo.note.add', { id: 'a1', text: 'hidden from Blake' }, 'o1');
    expect(b.ofType('update').length).toBe(before);
  });

  it('a client that reports a gap with resync receives a fresh snapshot', async () => {
    registerDemoIntents();
    await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('demo.note.add', { id: 'n1', text: 'one' }, 'o1');
    const welcomes = a.ofType('welcome').length;
    a.send({ type: 'resync', haveSeq: 0 });
    await flush();
    expect(a.ofType('welcome').length).toBe(welcomes + 1);
    const demo = a.state!.extensions.demo as { notes: Record<string, unknown> };
    expect(Object.keys(demo.notes)).toEqual(['n1']);
  });

  it('updates carry whole-item changes and deletions with null', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    const b = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await b.join('Blake');
    host.removeParticipant(b.participantId!);
    await flush();
    const last = a.ofType('update').at(-1)!;
    expect(last.changes).toContainEqual({ path: ['participants', b.participantId!], value: null });
  });
});

describe('host: join code lookup', () => {
  it('answers a lookup with the correct code with the session ID', async () => {
    await newHost({ joinCode: 'K7M4QX' });
    const t = new MemoryTransport(net);
    const conn = await t.connect(resolverPeerId('K7M4QX'));
    const seen: unknown[] = [];
    conn.onMessage((m) => seen.push(m));
    conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code: ' k7m4qx ' });
    await flush();
    expect(seen).toMatchObject([{ type: 'resolved', sessionId: 'SESSION1' }]);
  });

  it('a wrong code has no listener, so connecting fails', async () => {
    await newHost({ joinCode: 'K7M4QX' });
    await expect(new MemoryTransport(net).connect(resolverPeerId('ZZZZZZ'))).rejects.toThrow();
  });

  it('answers only one lookup per connection', async () => {
    await newHost({ joinCode: 'K7M4QX' });
    const conn = await new MemoryTransport(net).connect(resolverPeerId('K7M4QX'));
    const seen: unknown[] = [];
    conn.onMessage((m) => seen.push(m));
    conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code: 'K7M4QX' });
    conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code: 'K7M4QX' });
    await flush();
    expect(seen).toHaveLength(1);
  });

  it('answers at most 10 lookups per minute; further ones get notFound after a delay', async () => {
    vi.useFakeTimers();
    const host = await newHost({ joinCode: 'K7M4QX' });
    void host;
    const answers: { type: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const conn = await new MemoryTransport(net).connect(resolverPeerId('K7M4QX'));
      conn.onMessage((m) => answers.push(m as { type: string }));
      conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code: 'K7M4QX' });
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(answers.filter((a) => a.type === 'resolved')).toHaveLength(10);
    expect(answers.filter((a) => a.type === 'notFound')).toHaveLength(0); // delayed
    await vi.advanceTimersByTimeAsync(1100);
    expect(answers.filter((a) => a.type === 'notFound')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(60_000);
    const conn = await new MemoryTransport(net).connect(resolverPeerId('K7M4QX'));
    conn.onMessage((m) => answers.push(m as { type: string }));
    conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code: 'K7M4QX' });
    await vi.advanceTimersByTimeAsync(0);
    expect(answers.filter((a) => a.type === 'resolved')).toHaveLength(11);
  });

  it('generates a new code when the resolver ID is already taken at creation', async () => {
    await newHost({ joinCode: 'K7M4QX', sessionId: 'FIRST' });
    // second session asks for the same code: it must end up with a different one
    const second = await newHost({ joinCode: 'K7M4QX', sessionId: 'SECOND' });
    expect(second.data.state.joinCode).not.toBe('K7M4QX');
    expect(second.data.state.joinCode).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
  });
});

describe('host: persistence and resume', () => {
  it('writes a host record after every accepted change', async () => {
    registerDemoIntents();
    const host = await newHost();
    const id = host.data.state.sessionId;
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    expect(store.loadHostRecord(id)!.state.rev).toBe(host.data.state.rev);
    await a.intent('demo.note.add', { id: 'n1', text: 'x' }, 'o1');
    const rec = store.loadHostRecord(id)!;
    expect(rec.state.rev).toBe(host.data.state.rev);
    expect(Object.keys(rec.state.extensions.demo as object)).toContain('notes');
    host.startSession();
    expect(store.loadHostRecord(id)!.state.status).toBe('running');
  });

  it('a new HostController made from the record restores participants, tokens, rev and applied operations; clients reconnect by token', async () => {
    registerDemoIntents();
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    await a.intent('demo.note.add', { id: 'n1', text: 'x' }, 'op-1');
    const before = structuredClone(host.data);
    host.stop();
    await flush();
    expect(a.closed).toBe(true);

    const record = store.loadHostRecord('SESSION1')!;
    const resumed = HostController.resume(record, { transport: new MemoryTransport(net), store });
    hosts.push(resumed);
    await resumed.ready;
    expect(resumed.data.state.rev).toBe(before.state.rev);
    expect(resumed.data.tokens).toEqual(before.tokens);
    expect(resumed.data.appliedOps).toEqual(before.appliedOps);

    const again = await new RawClient(net).connect('SESSION1');
    await again.rejoin(a.token!);
    expect(again.participantId).toBe(a.participantId);
    expect(Object.keys(again.state!.participants)).toHaveLength(2);
    // the same operation re-sent after the resume is not applied twice
    const rev = resumed.data.state.rev;
    await again.intent('demo.note.add', { id: 'n1', text: 'x again' }, 'op-1');
    expect(again.ofType('ack').map((m) => m.opId)).toContain('op-1');
    expect(resumed.data.state.rev).toBe(rev);
  });

  it('retries with backoff when an ID is still taken at resume, and reports waiting', async () => {
    vi.useFakeTimers();
    const first = await newHost();
    const record = structuredClone(first.data);
    // a stale registration: another transport still holds the session ID
    const squatter = new MemoryTransport(net);
    first.stop();
    await squatter.listen('retro-s-SESSION1', () => {});
    const resumed = HostController.resume(record, { transport: new MemoryTransport(net), store });
    hosts.push(resumed);
    await vi.advanceTimersByTimeAsync(0);
    expect(resumed.listeningStatus).toBe('waiting');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(resumed.listeningStatus).toBe('waiting');
    squatter.stop(); // the old registration expires
    await vi.advanceTimersByTimeAsync(20_000);
    expect(resumed.listeningStatus).toBe('online');
    await resumed.ready;
  });

  it('a rejoin replaces an older connection of the same participant without marking them offline', async () => {
    const host = await newHost();
    const a = await new RawClient(net).connect('SESSION1');
    await a.join('Alex');
    const a2 = await new RawClient(net).connect('SESSION1');
    await a2.rejoin(a.token!);
    await flush();
    expect(a.closed).toBe(true);
    expect(host.data.state.participants[a.participantId!]!.presence).toBe('online');
  });
});

describe('host: scale', () => {
  it('8 clients join and one makes 100 intents; all converge to the same state', async () => {
    registerDemoIntents();
    const host = await newHost();
    const clients: RawClient[] = [];
    for (let i = 0; i < 8; i++) {
      const c = await new RawClient(net).connect('SESSION1');
      await c.join(`Person ${i}`);
      clients.push(c);
    }
    for (let i = 0; i < 100; i++) {
      clients[0]!.send({
        type: 'intent',
        opId: `op-${i}`,
        kind: 'demo.note.add',
        payload: { id: `n${i}`, text: `t${i}` },
      });
    }
    await flush(10);
    const expected = JSON.stringify((host.data.state.extensions.demo as { notes: object }).notes);
    for (const c of clients) {
      expect(c.gaps).toBe(0);
      expect(JSON.stringify((c.state!.extensions.demo as { notes: object }).notes)).toBe(expected);
    }
    expect(Object.keys((host.data.state.extensions.demo as { notes: object }).notes)).toHaveLength(100);
  });
});

// keep the type import used
export type _S = SessionState;
