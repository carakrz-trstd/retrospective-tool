// What a participant sees: the last state received from the host plus their own writes that the
// host has not acknowledged yet, replayed with the same rules the host uses. Computed when
// displaying and never written back into the stored state (AD-12).
import type { Intent } from '../core/protocol';
import type { SessionState } from '../core/types';
import { CONTRIB_INTENTS, applyIntent, type Actor } from './reducer';

export function overlayState(
  state: SessionState | null,
  outbox: Intent[],
  actor: Actor,
  now: number,
): SessionState | null {
  if (!state) return state;
  let shown = state;
  for (const intent of outbox) {
    if (!CONTRIB_INTENTS.includes(intent.kind)) continue;
    const result = applyIntent(shown, actor, { kind: intent.kind, payload: intent.payload }, 'overlay', now);
    // the host stays the final judge: an intent that does not apply here is simply not shown
    if (result.ok) shown = result.state;
  }
  return shown;
}
