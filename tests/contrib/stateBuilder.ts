import type { Participant, SessionState } from '../../src/core/types';
import { applyIntent, type Actor } from '../../src/contrib/reducer';
import { testFormat } from '../helpers';

export const F = 'p-fiona';
export const A = 'p-alex';
export const B = 'p-blake';

function person(id: string, displayName: string, isFacilitator = false): Participant {
  return {
    id,
    name: displayName,
    displayName,
    role: 'Dev',
    isFacilitator,
    presence: 'online',
    status: 'active',
    joinedAt: 0,
  };
}

/** A running session with Fiona (Facilitator), Alex and Blake. */
export function makeState(over: Partial<SessionState> = {}): SessionState {
  return {
    schemaVersion: 1,
    rev: 0,
    sessionId: 'SESSION1',
    joinCode: 'K7M4QX',
    createdAt: 0,
    status: 'running',
    format: structuredClone(testFormat),
    timeBudgetMin: 50,
    participants: { [F]: person(F, 'Fiona', true), [A]: person(A, 'Alex'), [B]: person(B, 'Blake') },
    extensions: {},
    ...over,
  };
}

export const actor = (id: string | null): Actor => ({ participantId: id, isFacilitator: id === F });

export function remove(state: SessionState, id: string): SessionState {
  return {
    ...state,
    participants: { ...state.participants, [id]: { ...state.participants[id]!, status: 'removed' } },
  };
}

export function reveal(state: SessionState, key: 'checkIn' | 'retro'): SessionState {
  const flow = (state.extensions.flow as Record<string, unknown> | undefined) ?? {};
  const revealed = { checkIn: false, retro: false, ...(flow.revealed as object | undefined), [key]: true };
  return { ...state, extensions: { ...state.extensions, flow: { ...flow, revealed } } };
}

/** Applies an intent and returns the new state (throws when it was refused). */
export function must(
  state: SessionState,
  who: string | null,
  kind: string,
  payload: unknown,
  now = 1_000,
): SessionState {
  const r = applyIntent(state, actor(who), { kind, payload }, 'host', now);
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.state;
}

export function reason(
  state: SessionState,
  who: string | null,
  kind: string,
  payload: unknown,
  mode: 'host' | 'overlay' = 'host',
): string | null {
  const r = applyIntent(state, actor(who), { kind, payload }, mode, 1_000);
  return r.ok ? null : r.reason;
}
