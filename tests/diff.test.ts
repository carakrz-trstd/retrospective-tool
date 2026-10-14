import { describe, expect, it } from 'vitest';
import { applyChanges, deepEqual, diffViews } from '../src/core/diff';
import type { Participant } from '../src/core/types';
import { makeState } from './helpers';

function person(id: string, over: Partial<Participant> = {}): Participant {
  return {
    id,
    name: id,
    displayName: id,
    role: 'Dev',
    isFacilitator: false,
    presence: 'online',
    status: 'active',
    joinedAt: 1,
    ...over,
  };
}

describe('deepEqual', () => {
  it('ignores key order and compares nested values', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });
});

describe('diffViews', () => {
  it('returns no changes for equal views', () => {
    const s = makeState({ participants: { a: person('a') } });
    expect(diffViews(s, structuredClone(s))).toEqual([]);
  });

  it('ignores rev (it travels in the update envelope)', () => {
    const s = makeState();
    expect(diffViews(s, { ...s, rev: 7 })).toEqual([]);
  });

  it('reports changed top-level fields', () => {
    const s = makeState();
    expect(diffViews(s, { ...s, status: 'running' })).toEqual([{ path: ['status'], value: 'running' }]);
  });

  it('replaces whole participants and deletes missing ones with null', () => {
    const prev = makeState({ participants: { a: person('a'), b: person('b') } });
    const next = makeState({ participants: { a: person('a', { presence: 'offline' }), c: person('c') } });
    const changes = diffViews(prev, next);
    expect(changes).toContainEqual({ path: ['participants', 'a'], value: next.participants.a });
    expect(changes).toContainEqual({ path: ['participants', 'c'], value: next.participants.c });
    expect(changes).toContainEqual({ path: ['participants', 'b'], value: null });
    expect(changes).toHaveLength(3);
  });

  it('descends into extensions down to the item: extension, collection, item id', () => {
    const prev = makeState({
      extensions: { contrib: { entries: { e1: { text: 'one' } } }, flow: { stop: 'checkIn' } },
    });
    const next = makeState({
      extensions: {
        contrib: { entries: { e1: { text: 'one' }, e2: { text: 'two' } } },
        flow: { stop: 'retro' },
      },
    });
    const changes = diffViews(prev, next);
    expect(changes).toContainEqual({
      path: ['extensions', 'contrib', 'entries', 'e2'],
      value: { text: 'two' },
    });
    expect(changes).toContainEqual({ path: ['extensions', 'flow', 'stop'], value: 'retro' });
    expect(changes).toHaveLength(2);
  });

  it('a reveal of N items is one result with N changes', () => {
    const entries = (n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`e${i}`, { text: `t${i}` }]));
    const prev = makeState({ extensions: { contrib: { entries: {} } } });
    const next = makeState({ extensions: { contrib: { entries: entries(5) } } });
    expect(diffViews(prev, next)).toHaveLength(5);
  });

  it('deletes a removed item and a removed extension', () => {
    const prev = makeState({ extensions: { contrib: { entries: { e1: { a: 1 } } }, gone: { x: { y: 1 } } } });
    const next = makeState({ extensions: { contrib: { entries: {} } } });
    const changes = diffViews(prev, next);
    expect(changes).toContainEqual({ path: ['extensions', 'contrib', 'entries', 'e1'], value: null });
    expect(changes).toContainEqual({ path: ['extensions', 'gone'], value: null });
  });
});

describe('applyChanges', () => {
  it('applying the diff of two views to the first view gives the second view', () => {
    const prev = makeState({
      participants: { a: person('a'), b: person('b') },
      extensions: { contrib: { entries: { e1: { text: 'one' } } }, gone: { x: { y: 1 } } },
    });
    const next = makeState({
      status: 'running',
      title: 'Team',
      participants: { a: person('a', { presence: 'offline' }), c: person('c') },
      extensions: {
        contrib: { entries: { e1: { text: 'changed' }, e2: { text: 'two' } } },
        flow: { stop: 'checkIn' },
      },
    });
    const result = applyChanges(prev, diffViews(prev, next));
    expect(result).toEqual({ ...next, rev: prev.rev });
  });

  it('creates missing intermediate objects and does not change its input', () => {
    const state = makeState();
    const snapshot = JSON.stringify(state);
    const result = applyChanges(state, [
      { path: ['extensions', 'contrib', 'entries', 'e1'], value: { text: 'x' } },
    ]);
    expect(result.extensions).toEqual({ contrib: { entries: { e1: { text: 'x' } } } });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
