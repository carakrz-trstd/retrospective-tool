// View filter of the flow slice: only the Facilitator gets the contribution counts, and only
// { added, total } leaves the host (no names, no content).
import { registerViewFilter } from '../core/registry';
import type { SessionState } from '../core/types';
import { FLOW_KEY, getFlow } from './flowState';
import { getContributionCounter, type CounterKey } from './registries';

export { FLOW_KEY };

export function isRevealed(state: SessionState, key: CounterKey): boolean {
  return getFlow(state).revealed[key];
}

export interface Counts {
  added: number;
  total: number;
}

const KEYS: CounterKey[] = ['checkIn', 'retro'];

function computeCounts(state: SessionState): Record<CounterKey, Counts> {
  const total = Object.keys(state.participants).length;
  const out = {} as Record<CounterKey, Counts>;
  for (const key of KEYS) {
    const fn = getContributionCounter(key);
    const r = fn ? fn(state) : { added: 0, total };
    out[key] = { added: Number(r.added) || 0, total: Number(r.total) || 0 };
  }
  return out;
}

export function flowViewFilter(state: SessionState, participantId: string): SessionState {
  const stored = state.extensions[FLOW_KEY] as Record<string, unknown> | undefined;
  if (state.participants[participantId]?.isFacilitator && state.status === 'running') {
    return {
      ...state,
      extensions: { ...state.extensions, [FLOW_KEY]: { ...getFlow(state), counts: computeCounts(state) } },
    };
  }
  if (stored && 'counts' in stored) {
    const { counts: _counts, ...rest } = stored;
    return { ...state, extensions: { ...state.extensions, [FLOW_KEY]: rest } };
  }
  return state;
}

export function registerFlowView(): void {
  registerViewFilter(flowViewFilter);
}
