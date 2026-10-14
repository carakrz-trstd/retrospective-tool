import type { SessionState } from '../core/types';
import type { FlowState } from './types';

export const FLOW_KEY = 'flow';

export function initialFlow(): FlowState {
  return { stop: 'checkIn', timers: {}, revealed: { checkIn: false, retro: false }, soundMutedForAll: false };
}

/** The stored flow slice, or the initial one (Epic 1's session creation needs no change). */
export function getFlow(state: SessionState): FlowState {
  const stored = state.extensions[FLOW_KEY] as Partial<FlowState> | undefined;
  const base = initialFlow();
  if (!stored) return base;
  return {
    stop: stored.stop ?? base.stop,
    timers: stored.timers ?? base.timers,
    revealed: { ...base.revealed, ...stored.revealed },
    soundMutedForAll: stored.soundMutedForAll ?? base.soundMutedForAll,
  };
}

export function setFlow(state: SessionState, flow: FlowState): SessionState {
  return { ...state, extensions: { ...state.extensions, [FLOW_KEY]: flow } };
}
