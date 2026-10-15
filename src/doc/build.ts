// Builds the document model from the session state: the host's full state, or a participant's
// last received view. Only revealed content is used, whoever builds it (the contribution summary
// of Epic 4 enforces that), and no IDs, tokens or survey keys end up in the model.
import { buildContributionSummary } from '../contrib/summary';
import type { SessionState } from '../core/types';
import { DOC_VERSION, type DocumentModel, type DocPerson } from './model';

function localDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const asEntry = (e: { authorName: string; text: string }) => ({ author: e.authorName, text: e.text });

export function buildDocumentModel(state: SessionState, options: { incomplete: boolean }): DocumentModel {
  const summary = buildContributionSummary(state);
  const date = localDate(state.createdAt);
  const title = state.title?.trim() ? state.title.trim() : undefined;

  const participants: DocPerson[] = Object.values(state.participants)
    .filter((p) => p.status === 'active')
    .sort((a, b) => Number(b.isFacilitator) - Number(a.isFacilitator) || a.joinedAt - b.joinedAt)
    .map((p) => ({ name: p.displayName, role: p.role, isFacilitator: p.isFacilitator }));

  return {
    version: DOC_VERSION,
    incomplete: options.incomplete,
    heading: title ?? `Retrospective, ${date}, ${state.format.name}`,
    ...(title ? { title } : {}),
    date,
    format: {
      name: state.format.name,
      custom: state.format.custom === true,
      columns: state.format.columns.map((c) => ({ name: c.name, ...(c.prompt ? { prompt: c.prompt } : {}) })),
    },
    timeBudgetMin: state.timeBudgetMin,
    participants,
    checkIn: { question: state.format.checkInQuestion, responses: summary.checkIn.map(asEntry) },
    retro: {
      columns: summary.retro.map((c) => ({
        name: c.columnName,
        ...(c.prompt ? { prompt: c.prompt } : {}),
        entries: c.entries.map(asEntry),
      })),
    },
    notes: {
      ...(summary.noteTaker ? { noteTaker: summary.noteTaker } : {}),
      items: summary.notes.map((n) => ({ text: n.text, author: n.authorName })),
    },
    actions: summary.actions,
    survey: { answered: summary.survey.count, retro: summary.survey.retro, tool: summary.survey.tool },
  };
}
