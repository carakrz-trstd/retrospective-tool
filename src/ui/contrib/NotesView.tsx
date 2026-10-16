import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { NOTE_MAX, normalizeText, truncate } from '../../contrib/limits';
import { getContribView, type NoteItem } from '../../contrib/types';
import { createUuid } from '../../core/ids';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { Avatar } from '../Avatar';
import { EmptyState } from '../EmptyState';
import { CharCounter } from './CharCounter';
import { EntryComposer } from './EntryComposer';
import { byCreated, nameOf } from './names';
import { RejectedNotice } from './RejectedNotice';

function NoteCard(props: { note: NoteItem; authorName: string; isFacilitator: boolean }) {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.note.text);
  const { note } = props;
  return (
    <li class="entry-card note-card" data-note-id={note.id}>
      {editing ? (
        <div class="entry-edit">
          <textarea
            aria-label={texts.contrib.noteText}
            rows={3}
            value={draft}
            onInput={(e) => {
              const cut = truncate(e.currentTarget.value, NOTE_MAX);
              if (e.currentTarget.value !== cut) e.currentTarget.value = cut;
              setDraft(cut);
            }}
          />
          <CharCounter text={draft} max={NOTE_MAX} />
          <div class="row">
            <button
              type="button"
              class="primary"
              disabled={normalizeText(draft) === ''}
              onClick={() => {
                app.sendIntent('note.edit', { id: note.id, text: normalizeText(draft) });
                setEditing(false);
              }}
            >
              {texts.contrib.save}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {texts.contrib.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p class="entry-text">{note.text}</p>
          <p class="entry-author hint">
            <Avatar name={props.authorName} />
            <span>{props.authorName}</span>
          </p>
          <div class="row entry-actions">
            <button
              type="button"
              aria-label={texts.contrib.editNote}
              onClick={() => {
                setDraft(note.text);
                setEditing(true);
              }}
            >
              {texts.contrib.edit}
            </button>
            {props.isFacilitator && (
              <button
                type="button"
                aria-label={texts.contrib.deleteNote}
                onClick={() => app.sendIntent('note.delete', { id: note.id })}
              >
                {texts.contrib.delete}
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

/** A shared list of separate note items: anyone adds and edits, the Facilitator deletes. */
export function NotesView(props: PhaseViewProps) {
  const app = useApp();
  const view = getContribView(props.state);
  const taker = view.noteTakerId ? props.state.participants[view.noteTakerId] : undefined;
  return (
    <section class="contrib-notes" aria-label="Discussion notes">
      <RejectedNotice />
      {taker && <p class="note-taker">{texts.contrib.noteTaker(taker.displayName)}</p>}
      <EntryComposer
        fieldLabel={texts.contrib.noteField}
        addLabel={texts.contrib.addNote}
        max={NOTE_MAX}
        rows={3}
        onAdd={(text) => app.sendIntent('note.add', { id: createUuid(), text })}
      />
      <ul class="entry-list" aria-label="Notes">
        {Object.values(view.notes)
          .sort(byCreated)
          .map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              authorName={nameOf(props.state, note.authorId)}
              isFacilitator={props.isFacilitator}
            />
          ))}
      </ul>
      {Object.keys(view.notes).length === 0 && <EmptyState icon="note" text={texts.contrib.noNotes} />}
    </section>
  );
}
