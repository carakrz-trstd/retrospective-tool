import { describe, expect, it } from 'vitest';
import { getContrib } from '../../src/contrib/types';
import { A, B, F, makeState, must, reason, remove } from './stateBuilder';

const add = (over: object = {}) => ({ id: 'a1', description: 'Fix the build', ownerIds: [A], ...over });

describe('action item rules (AC-8, AC-9, AC-10, AC-16, AC-23)', () => {
  it('an action without description or without owners is rejected', () => {
    const s = makeState();
    expect(reason(s, A, 'action.add', add({ description: ' ' }))).toBe('empty');
    expect(reason(s, A, 'action.add', add({ ownerIds: [] }))).toBe('owner-required');
    expect(reason(s, A, 'action.add', add({ description: 'x'.repeat(281) }))).toBe('too-long');
  });

  it('owners must be active participants; several owners are accepted; names are snapshots', () => {
    const s = makeState();
    expect(reason(s, A, 'action.add', add({ ownerIds: ['ghost'] }))).toBe('invalid-owner');
    expect(reason(remove(s, B), A, 'action.add', add({ ownerIds: [B] }))).toBe('invalid-owner');
    const done = must(s, A, 'action.add', add({ ownerIds: [A, B] }), 4_000);
    expect(getContrib(done).actions.a1).toMatchObject({
      owners: [
        { participantId: A, name: 'Alex' },
        { participantId: B, name: 'Blake' },
      ],
      createdBy: A,
      createdAt: 4_000,
    });
  });

  it('dueDate accepts 2026-03-01 and past dates and rejects 2026-02-30 and 01.03.2026', () => {
    const s = makeState();
    expect(reason(s, A, 'action.add', add({ dueDate: '2026-03-01' }))).toBeNull();
    expect(reason(s, A, 'action.add', add({ dueDate: '2001-01-01' }))).toBeNull();
    expect(reason(s, A, 'action.add', add({ dueDate: '2026-02-30' }))).toBe('invalid-date');
    expect(reason(s, A, 'action.add', add({ dueDate: '01.03.2026' }))).toBe('invalid-date');
  });

  it('anyone can edit description, owners and due date, and can clear the date', () => {
    let s = must(makeState(), A, 'action.add', add({ dueDate: '2026-03-01' }));
    s = must(
      s,
      B,
      'action.edit',
      { id: 'a1', description: 'New text', ownerIds: [B, F], dueDate: null },
      7_000,
    );
    const a = getContrib(s).actions.a1!;
    expect(a.description).toBe('New text');
    expect(a.owners.map((o) => o.participantId)).toEqual([B, F]);
    expect(a.dueDate).toBeUndefined();
    expect(a.updatedAt).toBe(7_000);
  });

  it('an edit may keep an owner who was removed, but cannot add a removed participant', () => {
    let s = must(makeState(), A, 'action.add', add({ ownerIds: [A, B] }));
    s = remove(s, B);
    expect(reason(s, A, 'action.edit', { id: 'a1', ownerIds: [A, B] })).toBeNull();
    expect(reason(s, A, 'action.edit', { id: 'a1', ownerIds: [A, 'ghost'] })).toBe('invalid-owner');
    const s2 = remove(must(makeState(), A, 'action.add', add()), B);
    expect(reason(s2, A, 'action.edit', { id: 'a1', ownerIds: [A, B] })).toBe('invalid-owner');
  });

  it('an edit that leaves no owner is rejected', () => {
    const s = must(makeState(), A, 'action.add', add());
    expect(reason(s, A, 'action.edit', { id: 'a1', ownerIds: [] })).toBe('owner-required');
  });

  it('only the Facilitator can delete', () => {
    const s = must(makeState(), A, 'action.add', add());
    expect(reason(s, A, 'action.delete', { id: 'a1' })).toBe('not-facilitator');
    expect(Object.keys(getContrib(must(s, F, 'action.delete', { id: 'a1' })).actions)).toEqual([]);
  });

  it('after the owner is removed from the session the item remains with the snapshot name', () => {
    const s = remove(must(makeState(), A, 'action.add', add({ ownerIds: [B] })), B);
    expect(getContrib(s).actions.a1!.owners[0]).toEqual({ participantId: B, name: 'Blake' });
  });
});
