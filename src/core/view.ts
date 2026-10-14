// viewFor is the ONLY way session state leaves the host (AC-22). It builds the state one
// participant is allowed to see: removed participants are dropped and every registered view
// filter (for example "hide other people's unrevealed entries") is applied.

import { applyViewFilters } from './registry';
import type { SessionState } from './types';

export function viewFor(state: SessionState, participantId: string): SessionState {
  // A deep copy first, so neither the filters nor the receiver can touch the host's state.
  const copy = structuredClone(state);
  const participants = Object.fromEntries(
    Object.entries(copy.participants).filter(([, p]) => p.status !== 'removed'),
  );
  return applyViewFilters({ ...copy, participants }, participantId);
}
