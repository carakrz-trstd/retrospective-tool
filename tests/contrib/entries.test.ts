import { describe, expect, it } from 'vitest';
import { getContrib } from '../../src/contrib/types';
import { A, B, F, makeState, must, reason, remove } from './stateBuilder';

const add = (id: string, text = 'hello', over: object = {}) => ({
  id,
  kind: 'retro',
  columnId: 'a',
  text,
  ...over,
});

describe('entry rules (AC-1, AC-2, AC-15, AC-16, AC-17, AC-20)', () => {
  it('entry.add creates an entry with the sender as author; a forged authorId is ignored', () => {
    const s = must(makeState(), A, 'entry.add', add('e1', 'hi', { authorId: B }), 5_000);
    const e = getContrib(s).entries.e1!;
    expect(e).toMatchObject({
      id: 'e1',
      kind: 'retro',
      columnId: 'a',
      text: 'hi',
      authorId: A,
      createdAt: 5_000,
    });
  });

  it('retro needs an existing column; check-in must not have one', () => {
    const s = makeState();
    expect(reason(s, A, 'entry.add', { id: 'e', kind: 'retro', text: 'x' })).toBe('invalid');
    expect(reason(s, A, 'entry.add', add('e', 'x', { columnId: 'nope' }))).toBe('unknown-column');
    expect(reason(s, A, 'entry.add', { id: 'e', kind: 'checkIn', columnId: 'a', text: 'x' })).toBe('invalid');
    expect(reason(s, A, 'entry.add', { id: 'e', kind: 'checkIn', text: 'x' })).toBeNull();
  });

  it('281 characters are rejected, 280 accepted, empty rejected', () => {
    const s = makeState();
    expect(reason(s, A, 'entry.add', add('e', 'a'.repeat(281)))).toBe('too-long');
    expect(reason(s, A, 'entry.add', add('e', 'a'.repeat(280)))).toBeNull();
    expect(reason(s, A, 'entry.add', add('e', '   '))).toBe('empty');
  });

  it('adding is rejected when the session is not running', () => {
    expect(reason(makeState({ status: 'lobby' }), A, 'entry.add', add('e'))).toBe('not-running');
    expect(reason(makeState({ status: 'ended' }), A, 'entry.add', add('e'))).toBe('not-running');
  });

  it('the same intent twice (same ID, author, text) gives one entry; the same ID from another author is rejected', () => {
    let s = must(makeState(), A, 'entry.add', add('e1'));
    s = must(s, A, 'entry.add', add('e1'));
    expect(Object.keys(getContrib(s).entries)).toEqual(['e1']);
    expect(reason(s, B, 'entry.add', add('e1'))).toBe('id-taken');
    expect(reason(s, A, 'entry.add', add('e1', 'different'))).toBe('id-taken');
  });

  it('a second check-in entry by the same author is rejected; another author may answer; the response can be edited', () => {
    let s = must(makeState(), A, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'fine' });
    expect(reason(s, A, 'entry.add', { id: 'c2', kind: 'checkIn', text: 'again' })).toBe('already-answered');
    s = must(s, B, 'entry.add', { id: 'c3', kind: 'checkIn', text: 'good' });
    s = must(s, A, 'entry.edit', { id: 'c1', text: 'better' }, 9_000);
    expect(getContrib(s).entries.c1).toMatchObject({ text: 'better', updatedAt: 9_000 });
  });

  it('entry.edit works for the author only (also not for the Facilitator)', () => {
    const s = must(makeState(), A, 'entry.add', add('e1'));
    expect(reason(s, B, 'entry.edit', { id: 'e1', text: 'x' })).toBe('not-author');
    expect(reason(s, F, 'entry.edit', { id: 'e1', text: 'x' })).toBe('not-author');
    expect(reason(s, A, 'entry.edit', { id: 'e1', text: 'x'.repeat(281) })).toBe('too-long');
    expect(reason(s, A, 'entry.edit', { id: 'nope', text: 'x' })).toBe('unknown-item');
  });

  it('entry.delete works for the author and the Facilitator, not for others', () => {
    const s = must(makeState(), A, 'entry.add', add('e1'));
    expect(reason(s, B, 'entry.delete', { id: 'e1' })).toBe('not-author');
    expect(Object.keys(getContrib(must(s, A, 'entry.delete', { id: 'e1' })).entries)).toEqual([]);
    expect(Object.keys(getContrib(must(s, F, 'entry.delete', { id: 'e1' })).entries)).toEqual([]);
  });

  it('there is no limit on the number of entries (50 are accepted)', () => {
    let s = makeState();
    for (let i = 0; i < 50; i++) s = must(s, A, 'entry.add', add(`e${i}`, `t${i}`));
    expect(Object.keys(getContrib(s).entries)).toHaveLength(50);
  });

  it('a removed participant cannot add entries; nobody without a participant can', () => {
    expect(reason(remove(makeState(), A), A, 'entry.add', add('e'))).toBe('not-participant');
    expect(reason(makeState(), null, 'entry.add', add('e'))).toBe('not-participant');
  });

  it('does not change the input state', () => {
    const s = makeState();
    const before = JSON.stringify(s);
    must(s, A, 'entry.add', add('e1'));
    expect(JSON.stringify(s)).toBe(before);
  });
});
