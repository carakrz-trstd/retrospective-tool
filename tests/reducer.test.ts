import { afterEach, describe, expect, it } from 'vitest';
import { createSession, end, join, rejoin, remove, setPresence, start } from '../src/core/reducer';
import { registerRemovalHook, resetRegistries } from '../src/core/registry';
import type { HostData } from '../src/core/types';
import { counter, testFormat } from './helpers';

afterEach(() => resetRegistries());

// Shared generators: every call of ctx() continues the same sequence, so IDs never collide.
const nextId = counter('p');
const nextToken = counter('t');

function ctx() {
  return { now: 5_000, newId: nextId, newToken: nextToken };
}

function newSession(title?: string) {
  const c = ctx();
  const created = createSession(
    {
      name: 'Fiona',
      role: 'Scrum Master',
      title,
      format: testFormat,
      timeBudgetMin: 50,
      sessionId: 'S1',
      joinCode: 'K7M4QX',
    },
    c,
  );
  return { ...created, c };
}

function joinOk(data: HostData, name: string, role = 'Dev', c = ctx()) {
  const result = join(data, { name, role }, c);
  if (!result.ok) throw new Error(`join failed: ${result.reason}`);
  return result;
}

describe('createSession (reducer.create)', () => {
  it('makes the creator the Facilitator: online, active, status lobby, with title, format and time budget', () => {
    const { data, facilitatorId } = newSession('Team Alpha');
    const s = data.state;
    expect(s.status).toBe('lobby');
    expect(s.title).toBe('Team Alpha');
    expect(s.format).toEqual(testFormat);
    expect(s.timeBudgetMin).toBe(50);
    expect(s.sessionId).toBe('S1');
    expect(s.joinCode).toBe('K7M4QX');
    const f = s.participants[facilitatorId]!;
    expect(f).toMatchObject({
      name: 'Fiona',
      displayName: 'Fiona',
      role: 'Scrum Master',
      isFacilitator: true,
      presence: 'online',
      status: 'active',
    });
    expect(Object.keys(s.participants)).toHaveLength(1);
  });

  it('leaves out a blank title', () => {
    expect(newSession('   ').data.state.title).toBeUndefined();
  });
});

describe('join (reducer.join)', () => {
  it('adds an active participant with a token', () => {
    const { data } = newSession();
    const r = joinOk(data, 'Alex', 'Developer');
    expect(r.token).toBeTruthy();
    const p = r.data.state.participants[r.participantId!]!;
    expect(p).toMatchObject({
      name: 'Alex',
      role: 'Developer',
      isFacilitator: false,
      presence: 'online',
      status: 'active',
    });
    expect(r.data.tokens[r.token!]).toBe(r.participantId);
  });

  it('rejects an empty or whitespace-only name or role', () => {
    const { data } = newSession();
    for (const input of [
      { name: '', role: 'Dev' },
      { name: '   ', role: 'Dev' },
      { name: 'Alex', role: '' },
      { name: 'Alex', role: '  ' },
    ]) {
      const r = join(data, input, ctx());
      expect(r.ok).toBe(false);
    }
  });

  it('trims name and role', () => {
    const { data } = newSession();
    const r = joinOk(data, '  Alex  ', '  Dev ');
    const p = r.data.state.participants[r.participantId!]!;
    expect(p.name).toBe('Alex');
    expect(p.role).toBe('Dev');
  });

  it('gives duplicate names a suffix: Sam, Sam (2), Sam (3)', () => {
    let { data } = newSession();
    const c = ctx();
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = joinOk(data, 'Sam', 'Dev', c);
      data = r.data;
      names.push(data.state.participants[r.participantId!]!.displayName);
    }
    expect(names).toEqual(['Sam', 'Sam (2)', 'Sam (3)']);
  });

  it('treats names that differ only in upper/lower case as duplicates', () => {
    let { data } = newSession();
    data = joinOk(data, 'sam').data;
    const r = joinOk(data, 'SAM');
    expect(r.data.state.participants[r.participantId!]!.displayName).toBe('SAM (2)');
  });

  it('allows joining when 9 or more participants exist (no hard limit)', () => {
    let { data } = newSession();
    const c = ctx();
    for (let i = 0; i < 11; i++) data = joinOk(data, `Person ${i}`, 'Dev', c).data;
    expect(Object.keys(data.state.participants)).toHaveLength(12);
  });

  it('rejects joining an ended session', () => {
    const { data, facilitatorId } = newSession();
    const ended = end(data, facilitatorId, ctx());
    expect(ended.ok).toBe(true);
    const r = join(ended.data, { name: 'Late', role: 'Dev' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('session-ended');
  });

  it('allows joining a running session (late join)', () => {
    const { data, facilitatorId } = newSession();
    const started = start(data, facilitatorId, ctx());
    expect(join(started.data, { name: 'Late', role: 'Dev' }, ctx()).ok).toBe(true);
  });
});

describe('rejoin (reducer.rejoin)', () => {
  it('maps a known token to the same participant and sets them online, without a duplicate', () => {
    const { data } = newSession();
    const j = joinOk(data, 'Alex');
    const offline = setPresence(j.data, j.participantId!, 'offline', ctx());
    const r = rejoin(offline.data, j.token!, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.participantId).toBe(j.participantId);
      expect(r.data.state.participants[j.participantId!]!.presence).toBe('online');
      expect(Object.keys(r.data.state.participants)).toHaveLength(2);
    }
  });

  it('rejects an unknown token', () => {
    const { data } = newSession();
    const r = rejoin(data, 'nope', ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown-token');
  });

  it('rejects a token of a removed participant', () => {
    const { data, facilitatorId } = newSession();
    const j = joinOk(data, 'Alex');
    const removed = remove(j.data, facilitatorId, j.participantId!, ctx());
    expect(removed.ok).toBe(true);
    const r = rejoin(removed.data, j.token!, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('removed');
  });

  it('still allows a known token to rejoin an ended session (presence only)', () => {
    const { data, facilitatorId } = newSession();
    const j = joinOk(data, 'Alex');
    const ended = end(j.data, facilitatorId, ctx());
    const r = rejoin(ended.data, j.token!, ctx());
    expect(r.ok).toBe(true);
  });
});

describe('setPresence (reducer.presence)', () => {
  it('toggles online/offline without creating participants', () => {
    const { data } = newSession();
    const j = joinOk(data, 'Alex');
    const off = setPresence(j.data, j.participantId!, 'offline', ctx());
    expect(off.ok).toBe(true);
    expect(off.data.state.participants[j.participantId!]!.presence).toBe('offline');
    const on = setPresence(off.data, j.participantId!, 'online', ctx());
    expect(on.data.state.participants[j.participantId!]!.presence).toBe('online');
    expect(Object.keys(on.data.state.participants)).toHaveLength(2);
  });

  it('keeps a participant who leaves in the list as offline', () => {
    const { data } = newSession();
    const j = joinOk(data, 'Alex');
    const off = setPresence(j.data, j.participantId!, 'offline', ctx());
    expect(off.data.state.participants[j.participantId!]!.status).toBe('active');
  });

  it('rejects an unknown participant', () => {
    const { data } = newSession();
    expect(setPresence(data, 'ghost', 'offline', ctx()).ok).toBe(false);
  });
});

describe('start (reducer.start)', () => {
  it('lets the Facilitator start from the lobby', () => {
    const { data, facilitatorId } = newSession();
    const r = start(data, facilitatorId, ctx());
    expect(r.ok).toBe(true);
    expect(r.data.state.status).toBe('running');
  });

  it('rejects a non-Facilitator', () => {
    const { data } = newSession();
    const j = joinOk(data, 'Alex');
    const r = start(j.data, j.participantId!, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-facilitator');
    expect(r.data.state.status).toBe('lobby');
  });

  it('starting twice is a no-op', () => {
    const { data, facilitatorId } = newSession();
    const first = start(data, facilitatorId, ctx());
    const second = start(first.data, facilitatorId, ctx());
    expect(second.ok).toBe(true);
    expect(second.data.state.status).toBe('running');
    expect(second.data.state.rev).toBe(first.data.state.rev);
  });

  it('cannot start an ended session', () => {
    const { data, facilitatorId } = newSession();
    const ended = end(data, facilitatorId, ctx());
    expect(start(ended.data, facilitatorId, ctx()).ok).toBe(false);
  });
});

describe('remove (reducer.remove)', () => {
  it('lets only the Facilitator remove a participant', () => {
    const { data, facilitatorId } = newSession();
    const a = joinOk(data, 'Alex');
    const b = joinOk(a.data, 'Blake');
    const byParticipant = remove(b.data, a.participantId!, b.participantId!, ctx());
    expect(byParticipant.ok).toBe(false);
    if (!byParticipant.ok) expect(byParticipant.reason).toBe('not-facilitator');
    expect(byParticipant.data.state.participants[b.participantId!]!.status).toBe('active');
  });

  it('sets the status to removed, adds the token to removedTokens and reports a disconnect effect', () => {
    const { data, facilitatorId } = newSession();
    const a = joinOk(data, 'Alex');
    const r = remove(a.data, facilitatorId, a.participantId!, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.state.participants[a.participantId!]).toMatchObject({
        status: 'removed',
        presence: 'offline',
      });
      expect(r.data.removedTokens).toContain(a.token);
      expect(r.effects).toContainEqual({ type: 'disconnect', participantId: a.participantId });
    }
  });

  it('calls the registered removal hooks', () => {
    const removed: string[] = [];
    registerRemovalHook((state, id) => {
      removed.push(id);
      return state;
    });
    const { data, facilitatorId } = newSession();
    const a = joinOk(data, 'Alex');
    remove(a.data, facilitatorId, a.participantId!, ctx());
    expect(removed).toEqual([a.participantId]);
  });

  it('does not let the Facilitator remove themself, and rejects unknown participants', () => {
    const { data, facilitatorId } = newSession();
    const self = remove(data, facilitatorId, facilitatorId, ctx());
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.reason).toBe('cannot-remove-self');
    expect(remove(data, facilitatorId, 'ghost', ctx()).ok).toBe(false);
  });
});

describe('end (reducer.end)', () => {
  it('lets only the Facilitator end the session', () => {
    const { data, facilitatorId } = newSession();
    const a = joinOk(data, 'Alex');
    expect(end(a.data, a.participantId!, ctx()).ok).toBe(false);
    const r = end(a.data, facilitatorId, ctx());
    expect(r.ok).toBe(true);
    expect(r.data.state.status).toBe('ended');
  });

  it('after ended only presence changes are accepted', () => {
    const { data, facilitatorId } = newSession();
    const a = joinOk(data, 'Alex');
    const ended = end(a.data, facilitatorId, ctx());
    expect(join(ended.data, { name: 'X', role: 'Y' }, ctx()).ok).toBe(false);
    expect(start(ended.data, facilitatorId, ctx()).ok).toBe(false);
    expect(remove(ended.data, facilitatorId, a.participantId!, ctx()).ok).toBe(false);
    expect(setPresence(ended.data, a.participantId!, 'offline', ctx()).ok).toBe(true);
  });

  it('ending twice is a no-op', () => {
    const { data, facilitatorId } = newSession();
    const first = end(data, facilitatorId, ctx());
    const second = end(first.data, facilitatorId, ctx());
    expect(second.ok).toBe(true);
    expect(second.data.state.rev).toBe(first.data.state.rev);
  });
});

describe('rev (reducer.rev)', () => {
  it('increments with every accepted change and not with rejected ones', () => {
    const { data, facilitatorId } = newSession();
    const r0 = data.state.rev;
    const a = joinOk(data, 'Alex');
    expect(a.data.state.rev).toBe(r0 + 1);
    const rejected = join(a.data, { name: '', role: '' }, ctx());
    expect(rejected.data.state.rev).toBe(a.data.state.rev);
    const started = start(a.data, facilitatorId, ctx());
    expect(started.data.state.rev).toBe(a.data.state.rev + 1);
    const off = setPresence(started.data, a.participantId!, 'offline', ctx());
    expect(off.data.state.rev).toBe(started.data.state.rev + 1);
  });

  it('does not modify the input data (pure functions)', () => {
    const { data, facilitatorId } = newSession();
    const snapshot = JSON.stringify(data);
    joinOk(data, 'Alex');
    start(data, facilitatorId, ctx());
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
