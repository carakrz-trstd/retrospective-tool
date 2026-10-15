// Rules of the shared discussion notes: separate items, anyone adds and edits, the Facilitator deletes.
import { NOTE_MAX, validateText } from './limits';
import { fail, type NoteItem, type RuleContext, type RuleResult } from './types';

const id = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : undefined;

export function addNote(c: RuleContext): RuleResult {
  const noteId = id(c.payload.id);
  if (!noteId || typeof c.payload.text !== 'string') return fail('invalid');
  const text = validateText(c.payload.text, NOTE_MAX);
  if (!text.ok) return fail(text.reason);
  const existing = c.contrib.notes[noteId];
  if (existing) {
    return existing.authorId === c.actor.participantId && existing.text === text.text
      ? { ok: true, contrib: c.contrib }
      : fail('id-taken');
  }
  const note: NoteItem = {
    id: noteId,
    text: text.text,
    authorId: c.actor.participantId!,
    createdAt: c.now,
    updatedAt: c.now,
  };
  return { ok: true, contrib: { ...c.contrib, notes: { ...c.contrib.notes, [noteId]: note } } };
}

export function editNote(c: RuleContext): RuleResult {
  const noteId = id(c.payload.id);
  const note = noteId ? c.contrib.notes[noteId] : undefined;
  if (!noteId || !note) return fail('unknown-item');
  if (typeof c.payload.text !== 'string') return fail('invalid');
  const text = validateText(c.payload.text, NOTE_MAX);
  if (!text.ok) return fail(text.reason);
  const next: NoteItem = {
    ...note,
    text: text.text,
    updatedAt: c.now,
    lastEditorId: c.actor.participantId!,
  };
  return { ok: true, contrib: { ...c.contrib, notes: { ...c.contrib.notes, [noteId]: next } } };
}

export function deleteNote(c: RuleContext): RuleResult {
  const noteId = id(c.payload.id);
  if (!noteId || !c.contrib.notes[noteId]) return fail('unknown-item');
  const { [noteId]: _removed, ...rest } = c.contrib.notes;
  return { ok: true, contrib: { ...c.contrib, notes: rest } };
}

export function setNoteTaker(c: RuleContext): RuleResult {
  const target = c.payload.participantId;
  if (target === null) {
    const { noteTakerId: _cleared, ...rest } = c.contrib;
    return { ok: true, contrib: rest };
  }
  if (typeof target !== 'string' || c.state.participants[target]?.status !== 'active') {
    return fail('unknown-participant');
  }
  return { ok: true, contrib: { ...c.contrib, noteTakerId: target } };
}
