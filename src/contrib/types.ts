// Data of the participant contributions (Epic 4): stored at state.extensions.contrib.
import type { SessionState } from '../core/types';

export const CONTRIB_KEY = 'contrib';

export type EntryKind = 'checkIn' | 'retro';

export interface Entry {
  id: string;
  kind: EntryKind;
  /** Required for 'retro' (a column of the chosen format), absent for 'checkIn'. */
  columnId?: string;
  text: string;
  /** Participant ID of the sender (set by the host, never by the client). */
  authorId: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteItem {
  id: string;
  text: string;
  authorId: string;
  createdAt: number;
  updatedAt: number;
  lastEditorId?: string;
}

/** The name is the display name when the owner was assigned; it stays as plain text. */
export interface ActionOwner {
  participantId: string;
  name: string;
}

export interface ActionItem {
  id: string;
  description: string;
  owners: ActionOwner[];
  /** 'YYYY-MM-DD', a valid calendar date. */
  dueDate?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface SurveyAnswer {
  retroRating: Rating;
  retroComment?: string;
  toolRating: Rating;
  toolComment?: string;
}

export interface ContribState {
  entries: Record<string, Entry>;
  notes: Record<string, NoteItem>;
  actions: Record<string, ActionItem>;
  noteTakerId?: string;
  /** Keyed by a random answer key from the answering device, never by a participant (AD-11). */
  survey: { closed: boolean; answers: Record<string, SurveyAnswer> };
}

/** What a recipient receives: the survey shows a count, and the answers only once it is final. */
export interface ContribView {
  entries: Record<string, Entry>;
  notes: Record<string, NoteItem>;
  actions: Record<string, ActionItem>;
  noteTakerId?: string;
  survey: { closed: boolean; count: number; answers?: SurveyAnswer[] };
}

export function emptyContrib(): ContribState {
  return { entries: {}, notes: {}, actions: {}, survey: { closed: false, answers: {} } };
}

/** The stored slice, or an empty one (Epic 1's session creation needs no change). */
export function getContrib(state: SessionState): ContribState {
  const stored = state.extensions[CONTRIB_KEY] as Partial<ContribState> | undefined;
  const base = emptyContrib();
  if (!stored) return base;
  return {
    entries: stored.entries ?? base.entries,
    notes: stored.notes ?? base.notes,
    actions: stored.actions ?? base.actions,
    ...(stored.noteTakerId ? { noteTakerId: stored.noteTakerId } : {}),
    survey: {
      closed: stored.survey?.closed ?? false,
      answers: stored.survey?.answers ?? base.survey.answers,
    },
  };
}

/** The slice as the screens read it: works for a full state and for a recipient's view. */
export function getContribView(state: SessionState): ContribView {
  const raw = state.extensions[CONTRIB_KEY] as
    | (Omit<Partial<ContribState>, 'survey'> & {
        survey?: {
          closed?: boolean;
          count?: number;
          answers?: SurveyAnswer[] | Record<string, SurveyAnswer>;
        };
      })
    | undefined;
  const answers = raw?.survey?.answers;
  const survey: ContribView['survey'] = {
    closed: raw?.survey?.closed ?? false,
    count: Array.isArray(answers)
      ? answers.length
      : answers
        ? Object.keys(answers).length
        : (raw?.survey?.count ?? 0),
  };
  if (Array.isArray(answers)) survey.answers = answers;
  return {
    entries: raw?.entries ?? {},
    notes: raw?.notes ?? {},
    actions: raw?.actions ?? {},
    ...(raw?.noteTakerId ? { noteTakerId: raw.noteTakerId } : {}),
    survey,
  };
}

// ---- intents and rule plumbing ------------------------------------------------------------

export interface Actor {
  participantId: string | null;
  isFacilitator: boolean;
}

/** 'host' is the final judge; 'overlay' replays a participant's own unacknowledged intents. */
export type Mode = 'host' | 'overlay';

export interface ContribIntent {
  kind: string;
  payload: unknown;
}

export interface RuleContext {
  state: SessionState;
  contrib: ContribState;
  actor: Actor;
  payload: Record<string, unknown>;
  now: number;
  mode: Mode;
}

export type RuleResult = { ok: true; contrib: ContribState } | { ok: false; reason: string };

export const fail = (reason: string): RuleResult => ({ ok: false, reason });
