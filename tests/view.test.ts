import { afterEach, describe, expect, it } from 'vitest';
import { registerViewFilter, resetRegistries } from '../src/core/registry';
import { viewFor } from '../src/core/view';
import type { Participant } from '../src/core/types';
import { makeState } from './helpers';

afterEach(() => resetRegistries());

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

describe('viewFor', () => {
  it('omits removed participants', () => {
    const state = makeState({ participants: { a: person('a'), b: person('b', { status: 'removed' }) } });
    const view = viewFor(state, 'a');
    expect(Object.keys(view.participants)).toEqual(['a']);
  });

  it('applies registered view filters in order', () => {
    registerViewFilter((s) => ({ ...s, extensions: { ...s.extensions, order: ['first'] } }));
    registerViewFilter((s) => ({
      ...s,
      extensions: { ...s.extensions, order: [...(s.extensions.order as string[]), 'second'] },
    }));
    const view = viewFor(makeState({ participants: { a: person('a') } }), 'a');
    expect(view.extensions.order).toEqual(['first', 'second']);
  });

  it("a filter can hide other participants' items while the author keeps theirs", () => {
    const state = makeState({
      participants: { a: person('a'), b: person('b') },
      extensions: {
        entries: {
          e1: { id: 'e1', authorId: 'a', text: 'mine' },
          e2: { id: 'e2', authorId: 'b', text: 'hidden from a' },
        },
      },
    });
    registerViewFilter((s, pid) => {
      const entries = s.extensions.entries as Record<string, { authorId: string }>;
      const visible = Object.fromEntries(Object.entries(entries).filter(([, e]) => e.authorId === pid));
      return { ...s, extensions: { ...s.extensions, entries: visible } };
    });
    expect(Object.keys(viewFor(state, 'a').extensions.entries as object)).toEqual(['e1']);
    expect(Object.keys(viewFor(state, 'b').extensions.entries as object)).toEqual(['e2']);
  });

  it('shares no references with the host state, so a view can never leak or change hidden data', () => {
    const state = makeState({
      participants: { a: person('a') },
      extensions: { deep: { list: [1, 2, 3] } },
    });
    const view = viewFor(state, 'a');
    (view.extensions.deep as { list: number[] }).list.push(4);
    view.participants.a!.name = 'changed';
    expect((state.extensions.deep as { list: number[] }).list).toEqual([1, 2, 3]);
    expect(state.participants.a!.name).toBe('a');
  });

  it('never returns the host state object itself', () => {
    const state = makeState({ participants: { a: person('a') } });
    expect(viewFor(state, 'a')).not.toBe(state);
  });
});
