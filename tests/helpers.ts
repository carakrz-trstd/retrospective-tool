import type { HostData, SessionState } from '../src/core/types';
import { SESSION_SCHEMA_VERSION } from '../src/core/types';

import { sampleFormat } from './formats/sample';

export const testFormat = sampleFormat();

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
