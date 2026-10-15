// What happens when the session ends: the warning about hidden entries and the final documentation
// that the host adds to the `ended` message (and sends again when a participant comes back).
import { getContrib } from '../contrib/types';
import { registerEndGuard, registerEndPayload } from '../core/registry';
import type { SessionState } from '../core/types';
import { isRevealed } from '../flow/flowView';
import { buildDocumentModel } from './build';
import { isDocumentModel, type DocumentModel } from './model';

/** Entries that nobody could see so far; entries of removed participants do not count. */
export function countHiddenEntries(state: SessionState): number {
  return Object.values(getContrib(state).entries).filter(
    (e) => state.participants[e.authorId]?.status === 'active' && !isRevealed(state, e.kind),
  ).length;
}

export function hiddenEntriesGuard(state: SessionState): { message?: string } {
  const n = countHiddenEntries(state);
  if (n === 0) return {};
  const what = n === 1 ? '1 entry is' : `${n} entries are`;
  return {
    message: `${what} still hidden and will not be in the documentation. Cancel and use Reveal first, or end the session anyway.`,
  };
}

/** Computed once from the host's full state: identical for every participant. */
export function endPayload(state: SessionState): { final: DocumentModel } {
  return { final: buildDocumentModel(state, { incomplete: false }) };
}

export function parseFinalPayload(payload: unknown): DocumentModel | null {
  const final = (payload as { final?: unknown } | null | undefined)?.final;
  return isDocumentModel(final) ? final : null;
}

/** Safe to call more than once. */
export function registerDocEnd(): void {
  registerEndGuard(hiddenEntriesGuard);
  registerEndPayload(endPayload);
}
