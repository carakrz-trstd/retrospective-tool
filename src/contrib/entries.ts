// Rules of check-in responses and retro entries.
import { ENTRY_MAX, validateText } from './limits';
import { fail, type Entry, type EntryKind, type RuleContext, type RuleResult } from './types';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : undefined;

export function addEntry(c: RuleContext): RuleResult {
  const id = str(c.payload.id);
  const kind = c.payload.kind;
  if (!id || (kind !== 'checkIn' && kind !== 'retro') || typeof c.payload.text !== 'string')
    return fail('invalid');
  const columnId = c.payload.columnId;
  if (kind === 'checkIn' && columnId !== undefined && columnId !== null) return fail('invalid');
  if (kind === 'retro') {
    if (typeof columnId !== 'string') return fail('invalid');
    if (!c.state.format.columns.some((col) => col.id === columnId)) return fail('unknown-column');
  }
  const text = validateText(c.payload.text, ENTRY_MAX);
  if (!text.ok) return fail(text.reason);
  const author = c.actor.participantId!;

  const existing = c.contrib.entries[id];
  if (existing) {
    const same =
      existing.authorId === author &&
      existing.kind === kind &&
      existing.text === text.text &&
      (existing.columnId ?? null) === (typeof columnId === 'string' ? columnId : null);
    return same ? { ok: true, contrib: c.contrib } : fail('id-taken');
  }
  if (
    kind === 'checkIn' &&
    Object.values(c.contrib.entries).some((e) => e.kind === 'checkIn' && e.authorId === author)
  ) {
    return fail('already-answered');
  }
  const entry: Entry = {
    id,
    kind: kind as EntryKind,
    ...(kind === 'retro' ? { columnId: columnId as string } : {}),
    text: text.text,
    authorId: author,
    createdAt: c.now,
    updatedAt: c.now,
  };
  return { ok: true, contrib: { ...c.contrib, entries: { ...c.contrib.entries, [id]: entry } } };
}

export function editEntry(c: RuleContext): RuleResult {
  const id = str(c.payload.id);
  const entry = id ? c.contrib.entries[id] : undefined;
  if (!id || !entry) return fail('unknown-item');
  if (entry.authorId !== c.actor.participantId) return fail('not-author');
  if (typeof c.payload.text !== 'string') return fail('invalid');
  const text = validateText(c.payload.text, ENTRY_MAX);
  if (!text.ok) return fail(text.reason);
  const next: Entry = { ...entry, text: text.text, updatedAt: c.now };
  return { ok: true, contrib: { ...c.contrib, entries: { ...c.contrib.entries, [id]: next } } };
}

export function deleteEntry(c: RuleContext): RuleResult {
  const id = str(c.payload.id);
  const entry = id ? c.contrib.entries[id] : undefined;
  if (!id || !entry) return fail('unknown-item');
  if (entry.authorId !== c.actor.participantId && !c.actor.isFacilitator) return fail('not-author');
  const { [id]: _removed, ...rest } = c.contrib.entries;
  return { ok: true, contrib: { ...c.contrib, entries: rest } };
}
