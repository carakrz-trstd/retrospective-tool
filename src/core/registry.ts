// Extension points for later epics: intent handlers, view filters, end guards, removal hooks.

import type { SessionState } from './types';

export interface IntentContext {
  state: SessionState;
  /** Participant ID of the sender; null for anonymous intents (the host does not record the sender). */
  senderId: string | null;
  payload: unknown;
  /** Host time in ms. */
  now: number;
  opId: string;
}

export type IntentResult = { ok: true; state: SessionState } | { ok: false; reason: string };
export type IntentHandler = (ctx: IntentContext) => IntentResult;
export type ViewFilter = (state: SessionState, participantId: string) => SessionState;
export type EndGuard = (state: SessionState) => { message?: string };
export type RemovalHook = (state: SessionState, participantId: string) => SessionState;

interface IntentEntry {
  handler: IntentHandler;
  anonymous: boolean;
}

const intents = new Map<string, IntentEntry>();
let viewFilters: ViewFilter[] = [];
let endGuards: EndGuard[] = [];
let removalHooks: RemovalHook[] = [];

export function registerIntentHandler(
  type: string,
  handler: IntentHandler,
  options: { anonymous?: boolean } = {},
): void {
  if (intents.has(type)) throw new Error(`Intent handler already registered for "${type}"`);
  intents.set(type, { handler, anonymous: options.anonymous === true });
}

export function getIntentHandler(type: string): IntentHandler | undefined {
  return intents.get(type)?.handler;
}

export function isAnonymousIntent(type: string): boolean {
  return intents.get(type)?.anonymous === true;
}

export function registerViewFilter(filter: ViewFilter): void {
  viewFilters.push(filter);
}

export function applyViewFilters(state: SessionState, participantId: string): SessionState {
  return viewFilters.reduce((s, f) => f(s, participantId), state);
}

export function registerEndGuard(guard: EndGuard): void {
  endGuards.push(guard);
}

/** Messages of all end guards that have something to say. */
export function collectEndGuardMessages(state: SessionState): string[] {
  const messages: string[] = [];
  for (const guard of endGuards) {
    const { message } = guard(state);
    if (message) messages.push(message);
  }
  return messages;
}

export function registerRemovalHook(hook: RemovalHook): void {
  removalHooks.push(hook);
}

export function runRemovalHooks(state: SessionState, participantId: string): SessionState {
  return removalHooks.reduce((s, h) => h(s, participantId), state);
}

/** For tests. */
export function resetRegistries(): void {
  intents.clear();
  viewFilters = [];
  endGuards = [];
  removalHooks = [];
}
