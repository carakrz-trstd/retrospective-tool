// What Epic 5 reads to build the documentation. Never contains unrevealed entries, entries of
// removed participants, survey keys or participant IDs.
import type { SessionState } from '../core/types';
import { isRevealed } from '../flow/flowView';
import { aggregate, type QuestionResult } from './survey';
import { getContrib } from './types';

export interface SummaryEntry {
  authorName: string;
  text: string;
}

export interface ContributionSummary {
  checkIn: SummaryEntry[];
  retro: { columnId: string; columnName: string; prompt?: string; entries: SummaryEntry[] }[];
  notes: { text: string; authorName: string }[];
  noteTaker?: string;
  actions: { description: string; owners: string[]; dueDate?: string }[];
  survey: { closed: boolean; count: number; retro: QuestionResult; tool: QuestionResult };
}

const byCreated = <T extends { createdAt: number }>(a: T, b: T) => a.createdAt - b.createdAt;

export function buildContributionSummary(state: SessionState): ContributionSummary {
  const c = getContrib(state);
  const active = (id: string) => state.participants[id]?.status === 'active';
  const nameOf = (id: string) => state.participants[id]?.displayName ?? 'Former participant';
  const entries = Object.values(c.entries)
    .filter((e) => active(e.authorId) && isRevealed(state, e.kind))
    .sort(byCreated);

  const results = aggregate(Object.values(c.survey.answers));
  return {
    checkIn: entries
      .filter((e) => e.kind === 'checkIn')
      .map((e) => ({ authorName: nameOf(e.authorId), text: e.text })),
    retro: state.format.columns.map((col) => ({
      columnId: col.id,
      columnName: col.name,
      ...(col.prompt ? { prompt: col.prompt } : {}),
      entries: entries
        .filter((e) => e.kind === 'retro' && e.columnId === col.id)
        .map((e) => ({ authorName: nameOf(e.authorId), text: e.text })),
    })),
    notes: Object.values(c.notes)
      .sort(byCreated)
      .map((n) => ({ text: n.text, authorName: nameOf(n.authorId) })),
    ...(c.noteTakerId && state.participants[c.noteTakerId] ? { noteTaker: nameOf(c.noteTakerId) } : {}),
    actions: Object.values(c.actions)
      .sort(byCreated)
      .map((a) => ({
        description: a.description,
        // a person who is still in the session shows with the current name, others with the stored one
        owners: a.owners.map((o) => (active(o.participantId) ? nameOf(o.participantId) : o.name)),
        ...(a.dueDate ? { dueDate: a.dueDate } : {}),
      })),
    survey: { closed: c.survey.closed || state.status === 'ended', ...results },
  };
}
