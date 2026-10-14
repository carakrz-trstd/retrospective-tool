// Host-side session rules as pure functions: (data, input, ctx) => result.
// No clock, no randomness, no storage here: the caller passes time and ID generators in `ctx`.

import { createUuid } from './ids';
import { runRemovalHooks } from './registry';
import type {
  Effect,
  FormatRef,
  HostData,
  Participant,
  ReduceContext,
  ReduceResult,
  SessionState,
  TimeBudget,
} from './types';
import { SESSION_SCHEMA_VERSION } from './types';

function fail(data: HostData, reason: string): ReduceResult {
  return { ok: false, reason, data };
}

function ok(
  data: HostData,
  extra: { effects?: Effect[]; participantId?: string; token?: string } = {},
): ReduceResult {
  return {
    ok: true,
    data,
    effects: extra.effects ?? [],
    participantId: extra.participantId,
    token: extra.token,
  };
}

/** A copy of the data with a new state; the revision increases by one. */
function withState(data: HostData, state: SessionState): HostData {
  return { ...data, state: { ...state, rev: data.state.rev + 1 } };
}

function defaultId(): string {
  return createUuid();
}

function defaultToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isFacilitator(data: HostData, actorId: string): boolean {
  const p = data.state.participants[actorId];
  return !!p && p.isFacilitator && p.status === 'active';
}

/** First free display name among active participants: Sam, Sam (2), Sam (3), ... */
function uniqueDisplayName(state: SessionState, name: string): string {
  const taken = new Set(
    Object.values(state.participants)
      .filter((p) => p.status === 'active')
      .map((p) => p.displayName.toLowerCase()),
  );
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export interface CreateSessionInput {
  name: string;
  role: string;
  title?: string;
  format: FormatRef;
  timeBudgetMin: TimeBudget;
  sessionId: string;
  joinCode: string;
}

export function createSession(
  input: CreateSessionInput,
  ctx: ReduceContext,
): { data: HostData; facilitatorId: string } {
  const facilitatorId = (ctx.newId ?? defaultId)();
  const title = input.title?.trim();
  const facilitator: Participant = {
    id: facilitatorId,
    name: input.name.trim(),
    displayName: input.name.trim(),
    role: input.role.trim(),
    isFacilitator: true,
    presence: 'online',
    status: 'active',
    joinedAt: ctx.now,
  };
  const state: SessionState = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    rev: 0,
    sessionId: input.sessionId,
    joinCode: input.joinCode,
    ...(title ? { title } : {}),
    createdAt: ctx.now,
    status: 'lobby',
    format: input.format,
    timeBudgetMin: input.timeBudgetMin,
    participants: { [facilitatorId]: facilitator },
    extensions: {},
  };
  return { data: { state, tokens: {}, removedTokens: [], appliedOps: {} }, facilitatorId };
}

export function join(
  data: HostData,
  input: { name: string; role: string },
  ctx: ReduceContext,
): ReduceResult {
  const name = input.name.trim();
  const role = input.role.trim();
  if (!name) return fail(data, 'name-required');
  if (!role) return fail(data, 'role-required');
  if (data.state.status === 'ended') return fail(data, 'session-ended');

  const id = (ctx.newId ?? defaultId)();
  const token = (ctx.newToken ?? defaultToken)();
  const participant: Participant = {
    id,
    name,
    displayName: uniqueDisplayName(data.state, name),
    role,
    isFacilitator: false,
    presence: 'online',
    status: 'active',
    joinedAt: ctx.now,
  };
  const next = withState(data, {
    ...data.state,
    participants: { ...data.state.participants, [id]: participant },
  });
  return ok({ ...next, tokens: { ...next.tokens, [token]: id } }, { participantId: id, token });
}

export function rejoin(data: HostData, token: string, _ctx: ReduceContext): ReduceResult {
  if (data.removedTokens.includes(token)) return fail(data, 'removed');
  const id = data.tokens[token];
  if (!id) return fail(data, 'unknown-token');
  const participant = data.state.participants[id];
  if (!participant) return fail(data, 'unknown-token');
  if (participant.status === 'removed') return fail(data, 'removed');
  if (participant.presence === 'online') return ok(data, { participantId: id, token });
  const next = withState(data, {
    ...data.state,
    participants: { ...data.state.participants, [id]: { ...participant, presence: 'online' } },
  });
  return ok(next, { participantId: id, token });
}

export function setPresence(
  data: HostData,
  participantId: string,
  presence: 'online' | 'offline',
  _ctx: ReduceContext,
): ReduceResult {
  const participant = data.state.participants[participantId];
  if (!participant || participant.status !== 'active') return fail(data, 'unknown-participant');
  if (participant.presence === presence) return ok(data, { participantId });
  const next = withState(data, {
    ...data.state,
    participants: { ...data.state.participants, [participantId]: { ...participant, presence } },
  });
  return ok(next, { participantId });
}

export function start(data: HostData, actorId: string, _ctx: ReduceContext): ReduceResult {
  if (!isFacilitator(data, actorId)) return fail(data, 'not-facilitator');
  if (data.state.status === 'running') return ok(data);
  if (data.state.status === 'ended') return fail(data, 'session-ended');
  return ok(withState(data, { ...data.state, status: 'running' }));
}

export function remove(data: HostData, actorId: string, targetId: string, _ctx: ReduceContext): ReduceResult {
  if (!isFacilitator(data, actorId)) return fail(data, 'not-facilitator');
  if (data.state.status === 'ended') return fail(data, 'session-ended');
  if (targetId === actorId) return fail(data, 'cannot-remove-self');
  const target = data.state.participants[targetId];
  if (!target || target.status !== 'active') return fail(data, 'unknown-participant');

  const tokensOfTarget = Object.entries(data.tokens)
    .filter(([, id]) => id === targetId)
    .map(([token]) => token);

  const marked: SessionState = {
    ...data.state,
    participants: {
      ...data.state.participants,
      [targetId]: { ...target, status: 'removed', presence: 'offline' },
    },
  };
  const afterHooks = runRemovalHooks(marked, targetId);
  const next = withState(data, afterHooks);
  return ok(
    { ...next, removedTokens: [...next.removedTokens, ...tokensOfTarget] },
    {
      effects: [
        { type: 'disconnect', participantId: targetId },
        { type: 'participantRemoved', participantId: targetId },
      ],
      participantId: targetId,
    },
  );
}

export function end(data: HostData, actorId: string, _ctx: ReduceContext): ReduceResult {
  if (!isFacilitator(data, actorId)) return fail(data, 'not-facilitator');
  if (data.state.status === 'ended') return ok(data);
  return ok(withState(data, { ...data.state, status: 'ended' }));
}
