// The pure rules of all contribution intents. The host applies them as the final judge ('host');
// a participant's device replays its own unacknowledged intents with them ('overlay').
import type { SessionState } from '../core/types';
import { addAction, deleteAction, editAction } from './actions';
import { addEntry, deleteEntry, editEntry } from './entries';
import { addNote, deleteNote, editNote, setNoteTaker } from './notes';
import { closeSurvey, submitSurvey } from './survey';
import {
  CONTRIB_KEY,
  getContrib,
  type Actor,
  type ContribIntent,
  type Mode,
  type RuleContext,
  type RuleResult,
} from './types';

export type { Actor, Mode, ContribIntent };

export type ApplyResult = { ok: true; state: SessionState } | { ok: false; reason: string };

const refuse = (reason: string): ApplyResult => ({ ok: false, reason });

interface Rule {
  run: (c: RuleContext) => RuleResult;
  /** Needs a participant who is in the session (not the anonymous survey answer). */
  participant?: boolean;
  facilitatorOnly?: boolean;
  /** Replayed in the overlay (the survey is answered from the device's local copy instead). */
  overlay?: boolean;
}

const RULES: Record<string, Rule> = {
  'entry.add': { run: addEntry, participant: true, overlay: true },
  'entry.edit': { run: editEntry, participant: true, overlay: true },
  'entry.delete': { run: deleteEntry, participant: true, overlay: true },
  'note.add': { run: addNote, participant: true, overlay: true },
  'note.edit': { run: editNote, participant: true, overlay: true },
  'note.delete': { run: deleteNote, participant: true, facilitatorOnly: true, overlay: true },
  'note.taker': { run: setNoteTaker, participant: true, facilitatorOnly: true, overlay: true },
  'action.add': { run: addAction, participant: true, overlay: true },
  'action.edit': { run: editAction, participant: true, overlay: true },
  'action.delete': { run: deleteAction, participant: true, facilitatorOnly: true, overlay: true },
  'survey.submit': { run: submitSurvey },
  'survey.close': { run: closeSurvey, participant: true, facilitatorOnly: true },
};

export const CONTRIB_INTENTS = Object.keys(RULES);

export function applyIntent(
  state: SessionState,
  actor: Actor,
  intent: ContribIntent,
  mode: Mode,
  now: number,
): ApplyResult {
  const rule = RULES[intent.kind];
  if (!rule) return refuse('unknown-intent');
  if (mode === 'overlay' && !rule.overlay) return { ok: true, state };
  const payload =
    intent.payload && typeof intent.payload === 'object' ? (intent.payload as Record<string, unknown>) : {};

  const isSurveySubmit = intent.kind === 'survey.submit';
  if (state.status !== 'running' && !isSurveySubmit) return refuse('not-running');
  if (rule.participant) {
    const me = actor.participantId ? state.participants[actor.participantId] : undefined;
    if (!me || me.status !== 'active') return refuse('not-participant');
  }
  if (rule.facilitatorOnly && mode === 'host' && !actor.isFacilitator) return refuse('not-facilitator');

  const result = rule.run({ state, contrib: getContrib(state), actor, payload, now, mode });
  if (!result.ok) return result;
  return {
    ok: true,
    state: { ...state, extensions: { ...state.extensions, [CONTRIB_KEY]: result.contrib } },
  };
}
