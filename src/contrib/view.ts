// What each recipient may see of the contributions, the counters behind "N of M have added
// something", and the removal hook.
import type { SessionState } from '../core/types';
import { isRevealed } from '../flow/flowView';
import { CONTRIB_KEY, getContrib, type ContribView, type Entry, type EntryKind } from './types';

const isActive = (state: SessionState, participantId: string): boolean =>
  state.participants[participantId]?.status === 'active';

/** The survey is final once the Facilitator closed it or the session ended. */
export const surveyIsFinal = (state: SessionState): boolean =>
  getContrib(state).survey.closed || state.status === 'ended';

/** Entries of removed participants never leave the host (AD-17); others' entries wait for the reveal. */
export function visibleEntries(state: SessionState, participantId: string | null): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [id, entry] of Object.entries(getContrib(state).entries)) {
    if (!isActive(state, entry.authorId)) continue;
    if (entry.authorId === participantId || isRevealed(state, entry.kind)) out[id] = entry;
  }
  return out;
}

export function contribViewFilter(state: SessionState, participantId: string): SessionState {
  const c = getContrib(state);
  const answers = Object.values(c.survey.answers);
  const survey: ContribView['survey'] = { closed: c.survey.closed, count: answers.length };
  if (surveyIsFinal(state)) {
    // sorted by content, so the order says nothing about who answered first and stays stable
    survey.answers = answers.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  const view: ContribView = {
    entries: visibleEntries(state, participantId),
    notes: c.notes,
    actions: c.actions,
    ...(c.noteTakerId ? { noteTakerId: c.noteTakerId } : {}),
    survey,
  };
  return { ...state, extensions: { ...state.extensions, [CONTRIB_KEY]: view } };
}

/** Distinct authors with an entry of this kind (hidden entries included) and the active participants. */
export function countFor(state: SessionState, kind: EntryKind): { added: number; total: number } {
  const authors = new Set(
    Object.values(getContrib(state).entries)
      .filter((e) => e.kind === kind && isActive(state, e.authorId))
      .map((e) => e.authorId),
  );
  const total = Object.values(state.participants).filter((p) => p.status === 'active').length;
  return { added: authors.size, total };
}

/** Nothing is deleted (AD-17); the hook only makes sure that owners keep their name as plain text. */
export function contribRemovalHook(state: SessionState, participantId: string): SessionState {
  const c = getContrib(state);
  const person = state.participants[participantId];
  if (!person) return state;
  let changed = false;
  const actions = Object.fromEntries(
    Object.entries(c.actions).map(([id, action]) => {
      const owners = action.owners.map((o) => {
        if (o.participantId !== participantId || o.name) return o;
        changed = true;
        return { ...o, name: person.displayName };
      });
      return [id, { ...action, owners }];
    }),
  );
  return changed
    ? { ...state, extensions: { ...state.extensions, [CONTRIB_KEY]: { ...c, actions } } }
    : state;
}
