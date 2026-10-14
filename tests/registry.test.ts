import { afterEach, describe, expect, it } from 'vitest';
import {
  applyViewFilters,
  collectEndGuardMessages,
  getIntentHandler,
  isAnonymousIntent,
  registerEndGuard,
  registerIntentHandler,
  registerRemovalHook,
  registerViewFilter,
  resetRegistries,
  runRemovalHooks,
} from '../src/core/registry';
import { makeState } from './helpers';

afterEach(() => resetRegistries());

describe('registry', () => {
  it('unknown intent types have no handler', () => {
    expect(getIntentHandler('nope')).toBeUndefined();
  });

  it('a registered handler is returned and called with the sender participant ID', () => {
    let seen: string | null = 'none';
    registerIntentHandler('demo.add', ({ state, senderId }) => {
      seen = senderId;
      return { ok: true, state };
    });
    const handler = getIntentHandler('demo.add');
    expect(handler).toBeDefined();
    const state = makeState();
    handler!({ state, senderId: 'p1', payload: {}, now: 1, opId: 'o1' });
    expect(seen).toBe('p1');
  });

  it('registering the same type twice throws', () => {
    registerIntentHandler('demo.add', ({ state }) => ({ ok: true, state }));
    expect(() => registerIntentHandler('demo.add', ({ state }) => ({ ok: true, state }))).toThrow(
      /already registered/,
    );
  });

  it('remembers which intents are anonymous', () => {
    registerIntentHandler('demo.vote', ({ state }) => ({ ok: true, state }), { anonymous: true });
    registerIntentHandler('demo.add', ({ state }) => ({ ok: true, state }));
    expect(isAnonymousIntent('demo.vote')).toBe(true);
    expect(isAnonymousIntent('demo.add')).toBe(false);
    expect(isAnonymousIntent('unknown')).toBe(false);
  });

  it('collects the messages of end guards and ignores guards without a message', () => {
    registerEndGuard(() => ({ message: '3 entries are hidden' }));
    registerEndGuard(() => ({}));
    expect(collectEndGuardMessages(makeState())).toEqual(['3 entries are hidden']);
  });

  it('calls removal hooks with the removed participant', () => {
    const removed: string[] = [];
    registerRemovalHook((state, id) => {
      removed.push(id);
      return state;
    });
    runRemovalHooks(makeState(), 'p2');
    expect(removed).toEqual(['p2']);
  });

  it('applies view filters in order', () => {
    registerViewFilter((s) => ({ ...s, extensions: { ...s.extensions, a: 1 } }));
    registerViewFilter((s) => ({ ...s, extensions: { ...s.extensions, b: (s.extensions.a as number) + 1 } }));
    const view = applyViewFilters(makeState(), 'p1');
    expect(view.extensions).toEqual({ a: 1, b: 2 });
  });
});
