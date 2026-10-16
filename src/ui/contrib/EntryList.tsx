import { useApp } from '../../app/context';
import type { Entry } from '../../contrib/types';
import type { SessionState } from '../../core/types';
import { EmptyState } from '../EmptyState';
import type { IconName } from '../Icon';
import { EntryCard } from './EntryCard';
import { byCreated, nameOf } from './names';

/** Entries as cards: own entries can be edited, own entries and (for the Facilitator) all can be deleted. */
export function EntryList(props: {
  entries: Entry[];
  state: SessionState;
  isFacilitator: boolean;
  label: string;
  emptyText: string;
  emptyIcon?: IconName;
}) {
  const app = useApp();
  const me = app.myParticipantId.value;
  return (
    <>
      <ul class="entry-list" aria-label={props.label}>
        {[...props.entries].sort(byCreated).map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            authorName={nameOf(props.state, entry.authorId)}
            canEdit={entry.authorId === me}
            canDelete={entry.authorId === me || props.isFacilitator}
            onSave={(text) => app.sendIntent('entry.edit', { id: entry.id, text })}
            onDelete={() => app.sendIntent('entry.delete', { id: entry.id })}
          />
        ))}
      </ul>
      {props.entries.length === 0 && <EmptyState icon={props.emptyIcon ?? 'note'} text={props.emptyText} />}
    </>
  );
}
