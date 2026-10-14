import { describe, expect, it } from 'vitest';
import { Store, type ParticipantRecord } from '../src/storage/storage';
import { makeHostData } from './helpers';
import { MemoryStorage, ThrowingStorage } from './storageFakes';

const DAY = 24 * 60 * 60 * 1000;

function setup(startAt = 1_000_000) {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  let now = startAt;
  const store = new Store({ local, session, now: () => now, expiryMs: DAY });
  return {
    local,
    session,
    store,
    advance(ms: number) {
      now += ms;
    },
    setNow(t: number) {
      now = t;
    },
  };
}

function participantRecord(over: Partial<ParticipantRecord> = {}): ParticipantRecord {
  return {
    token: 'tok',
    participantId: 'p1',
    name: 'Alex',
    role: 'Dev',
    lastState: null,
    lastSeq: 0,
    outbox: [],
    leftLocally: false,
    ...over,
  };
}

describe('storage', () => {
  it('writes and reads a host record round trip', () => {
    const { store } = setup();
    const data = makeHostData();
    store.saveHostRecord(data);
    expect(store.loadHostRecord(data.state.sessionId)).toEqual(data);
  });

  it('writes and reads a participant record round trip', () => {
    const { store } = setup();
    const rec = participantRecord({ outbox: [{ opId: 'o1', kind: 'demo', payload: { a: 1 } }] });
    store.saveParticipantRecord('S1', rec);
    expect(store.loadParticipantRecord('S1')).toEqual(rec);
  });

  it('returns null for sessions without a record (for example from another browser)', () => {
    const { store } = setup();
    expect(store.loadHostRecord('missing')).toBeNull();
    expect(store.loadParticipantRecord('missing')).toBeNull();
  });

  it('does not load a record with an unknown schemaVersion and lists it for deletion', () => {
    const { store, local } = setup();
    local.setItem('retro.host.OLD', JSON.stringify({ schemaVersion: 999, savedAt: 1, data: {} }));
    expect(store.loadHostRecord('OLD')).toBeNull();
    expect(store.listUnreadable()).toContain('retro.host.OLD');
    store.deleteUnreadable();
    expect(local.getItem('retro.host.OLD')).toBeNull();
  });

  it('does not crash on a record that is not valid JSON', () => {
    const { store, local } = setup();
    local.setItem('retro.host.BROKEN', '{not json');
    expect(store.loadHostRecord('BROKEN')).toBeNull();
    expect(store.listUnreadable()).toContain('retro.host.BROKEN');
  });

  it('keeps an index of sessions for resume and rejoin offers', () => {
    const { store } = setup();
    store.saveHostRecord(makeHostData());
    store.saveParticipantRecord('S2', participantRecord());
    const index = store.listIndex();
    expect(index.map((e) => `${e.role}:${e.sessionId}`).sort()).toEqual([
      'host:sessionIdForTests0000',
      'participant:S2',
    ]);
  });

  it('removeSession deletes host, participant and final records and the index entries', () => {
    const { store, local } = setup();
    const data = makeHostData();
    const id = data.state.sessionId;
    store.saveHostRecord(data);
    store.saveParticipantRecord(id, participantRecord());
    local.setItem(`retro.final.${id}`, '{}');
    store.removeSession(id);
    expect(store.loadHostRecord(id)).toBeNull();
    expect(store.loadParticipantRecord(id)).toBeNull();
    expect(local.getItem(`retro.final.${id}`)).toBeNull();
    expect(store.listIndex()).toEqual([]);
  });

  it('removeSession keeps the records of other sessions', () => {
    const { store } = setup();
    store.saveParticipantRecord('A', participantRecord());
    store.saveParticipantRecord('B', participantRecord());
    store.removeSession('A');
    expect(store.loadParticipantRecord('A')).toBeNull();
    expect(store.loadParticipantRecord('B')).not.toBeNull();
  });

  it('sweepExpired removes records not written for 24 hours and keeps newer ones', () => {
    const { store, advance } = setup();
    store.saveParticipantRecord('OLD', participantRecord());
    advance(DAY - 1000);
    store.saveParticipantRecord('FRESH', participantRecord());
    advance(2000); // OLD is now older than 24 h, FRESH is not
    const removed = store.sweepExpired();
    expect(removed).toEqual(['OLD']);
    expect(store.loadParticipantRecord('OLD')).toBeNull();
    expect(store.loadParticipantRecord('FRESH')).not.toBeNull();
    expect(store.listIndex().map((e) => e.sessionId)).toEqual(['FRESH']);
  });

  it('writing a record again resets its 24-hour clock', () => {
    const { store, advance } = setup();
    store.saveParticipantRecord('S', participantRecord());
    advance(DAY - 1000);
    store.saveParticipantRecord('S', participantRecord({ lastSeq: 5 }));
    advance(DAY - 1000); // 2 days after creation, but only just under 24 h after the last write
    expect(store.sweepExpired()).toEqual([]);
    expect(store.loadParticipantRecord('S')?.lastSeq).toBe(5);
  });

  it('sweepExpired also removes expired final records and host records', () => {
    const { store, local, advance } = setup();
    const data = makeHostData();
    store.saveHostRecord(data);
    local.setItem(
      `retro.final.${data.state.sessionId}`,
      JSON.stringify({ schemaVersion: 1, savedAt: 1_000_000 }),
    );
    advance(DAY + 1);
    store.sweepExpired();
    expect(store.loadHostRecord(data.state.sessionId)).toBeNull();
    expect(local.getItem(`retro.final.${data.state.sessionId}`)).toBeNull();
  });

  it('survives a throwing localStorage: reports unavailable and does not crash', () => {
    const store = new Store({
      local: new ThrowingStorage(),
      session: new MemoryStorage(),
      now: () => 1,
      expiryMs: DAY,
    });
    expect(store.isAvailable()).toBe(false);
    expect(() => store.saveHostRecord(makeHostData())).not.toThrow();
    expect(store.loadHostRecord('x')).toBeNull();
    expect(store.listIndex()).toEqual([]);
    expect(() => store.sweepExpired()).not.toThrow();
    expect(() => store.removeSession('x')).not.toThrow();
    expect(store.loadIdentity()).toBeNull();
    expect(() => store.saveIdentity({ name: 'A', role: 'B' })).not.toThrow();
  });

  it('reports available when localStorage works', () => {
    expect(setup().store.isAvailable()).toBe(true);
  });

  it('saveIdentity / forgetIdentity store and clear name and role', () => {
    const { store } = setup();
    expect(store.loadIdentity()).toBeNull();
    store.saveIdentity({ name: 'Alex', role: 'Dev' });
    expect(store.loadIdentity()).toEqual({ name: 'Alex', role: 'Dev' });
    store.forgetIdentity();
    expect(store.loadIdentity()).toBeNull();
  });

  it('keeps the active-session pointer in sessionStorage, not localStorage', () => {
    const { store, local, session } = setup();
    expect(store.getActiveSession()).toBeNull();
    store.setActiveSession('S1');
    expect(store.getActiveSession()).toBe('S1');
    expect(session.getItem('retro.activeSession')).toBe('S1');
    expect(local.keys().some((k) => k.includes('activeSession'))).toBe(false);
    store.setActiveSession(null);
    expect(store.getActiveSession()).toBeNull();
  });
});
