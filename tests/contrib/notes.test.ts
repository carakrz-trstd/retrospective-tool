import { describe, expect, it } from 'vitest';
import { getContrib } from '../../src/contrib/types';
import { A, B, F, makeState, must, reason, remove } from './stateBuilder';

describe('note rules (AC-6, AC-7, AC-16, AC-24)', () => {
  it('anyone can add a note item', () => {
    let s = must(makeState(), A, 'note.add', { id: 'n1', text: 'one' });
    s = must(s, B, 'note.add', { id: 'n2', text: 'two' });
    expect(Object.keys(getContrib(s).notes)).toEqual(['n1', 'n2']);
    expect(getContrib(s).notes.n1).toMatchObject({ authorId: A, text: 'one' });
  });

  it('anyone can edit any item; the later change replaces the earlier one and sets lastEditorId', () => {
    let s = must(makeState(), B, 'note.add', { id: 'n1', text: 'one' });
    s = must(s, A, 'note.edit', { id: 'n1', text: 'from A' }, 2_000);
    s = must(s, F, 'note.edit', { id: 'n1', text: 'from F' }, 3_000);
    expect(getContrib(s).notes.n1).toMatchObject({
      text: 'from F',
      lastEditorId: F,
      authorId: B,
      updatedAt: 3_000,
    });
  });

  it('only the Facilitator can delete', () => {
    const s = must(makeState(), A, 'note.add', { id: 'n1', text: 'one' });
    expect(reason(s, A, 'note.delete', { id: 'n1' })).toBe('not-facilitator');
    expect(Object.keys(getContrib(must(s, F, 'note.delete', { id: 'n1' })).notes)).toEqual([]);
  });

  it('the Facilitator sets and clears the note taker, who must be an active participant', () => {
    let s = must(makeState(), F, 'note.taker', { participantId: B });
    expect(getContrib(s).noteTakerId).toBe(B);
    expect(reason(s, A, 'note.taker', { participantId: A })).toBe('not-facilitator');
    expect(reason(s, F, 'note.taker', { participantId: 'ghost' })).toBe('unknown-participant');
    expect(reason(remove(s, B), F, 'note.taker', { participantId: B })).toBe('unknown-participant');
    s = must(s, F, 'note.taker', { participantId: null });
    expect(getContrib(s).noteTakerId).toBeUndefined();
  });

  it('a note taker does not change who may edit', () => {
    let s = must(makeState(), F, 'note.taker', { participantId: B });
    s = must(s, A, 'note.add', { id: 'n1', text: 'x' });
    expect(reason(s, A, 'note.edit', { id: 'n1', text: 'y' })).toBeNull();
  });

  it('empty and too long text is rejected (1,000 allowed)', () => {
    const s = makeState();
    expect(reason(s, A, 'note.add', { id: 'n', text: ' ' })).toBe('empty');
    expect(reason(s, A, 'note.add', { id: 'n', text: 'a'.repeat(1001) })).toBe('too-long');
    expect(reason(s, A, 'note.add', { id: 'n', text: 'a'.repeat(1000) })).toBeNull();
  });

  it('adding the same note twice is a no-op; editing an unknown item is rejected', () => {
    let s = must(makeState(), A, 'note.add', { id: 'n1', text: 'one' });
    s = must(s, A, 'note.add', { id: 'n1', text: 'one' });
    expect(Object.keys(getContrib(s).notes)).toEqual(['n1']);
    expect(reason(s, A, 'note.edit', { id: 'nope', text: 'x' })).toBe('unknown-item');
  });
});
