import { useState } from 'preact/hooks';
import { ENTRY_MAX, normalizeText, truncate } from '../../contrib/limits';
import type { Entry } from '../../contrib/types';
import { texts } from '../../texts';
import { Avatar } from '../Avatar';
import { CharCounter } from './CharCounter';

/** One entry with its author's name; the author can edit it in place, the author and the Facilitator delete it. */
export function EntryCard(props: {
  entry: Entry;
  authorName: string;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.entry.text);
  const save = () => {
    const text = normalizeText(draft);
    if (!text) return;
    if (text !== props.entry.text) props.onSave(text);
    setEditing(false);
  };

  return (
    <li class="entry-card" data-entry-id={props.entry.id}>
      {editing ? (
        <div class="entry-edit">
          <textarea
            aria-label={texts.contrib.entryText}
            rows={2}
            value={draft}
            onInput={(e) => {
              const cut = truncate(e.currentTarget.value, ENTRY_MAX);
              if (e.currentTarget.value !== cut) e.currentTarget.value = cut;
              setDraft(cut);
            }}
          />
          <CharCounter text={draft} max={ENTRY_MAX} />
          <div class="row">
            <button type="button" class="primary" disabled={normalizeText(draft) === ''} onClick={save}>
              {texts.contrib.save}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {texts.contrib.cancel}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p class="entry-text">{props.entry.text}</p>
          <p class="entry-author hint">
            <Avatar name={props.authorName} />
            <span>{props.authorName}</span>
          </p>
          <div class="row entry-actions">
            {props.canEdit && (
              <button
                type="button"
                aria-label={texts.contrib.editEntry}
                onClick={() => {
                  setDraft(props.entry.text);
                  setEditing(true);
                }}
              >
                {texts.contrib.edit}
              </button>
            )}
            {props.canDelete && (
              <button type="button" aria-label={texts.contrib.deleteEntry} onClick={props.onDelete}>
                {texts.contrib.delete}
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
