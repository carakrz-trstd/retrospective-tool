import type { FormatRef, HostData, SessionState } from '../src/core/types';
import { SESSION_SCHEMA_VERSION } from '../src/core/types';

export const testFormat: FormatRef = {
  id: 'start-stop-continue',
  name: 'Start-Stop-Continue',
  columns: [
    { id: 'start', name: 'Start' },
    { id: 'stop', name: 'Stop' },
    { id: 'continue', name: 'Continue' },
  ],
  checkInQuestion: 'In one word: how are you arriving today?',
};

export function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    rev: 0,
    sessionId: 'sessionIdForTests0000',
    joinCode: 'K7M4QX',
    createdAt: 1_000,
    status: 'lobby',
    format: testFormat,
    timeBudgetMin: 50,
    participants: {},
    extensions: {},
    ...overrides,
  };
}

export function makeHostData(state: SessionState = makeState()): HostData {
  return { state, tokens: {}, removedTokens: [], appliedOps: {} };
}

/** Deterministic ID/token generators for reducer tests. */
export function counter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}
