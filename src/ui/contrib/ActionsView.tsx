import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { getContribView, type ActionItem } from '../../contrib/types';
import { createUuid } from '../../core/ids';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { ActionForm } from './ActionForm';
import { byCreated } from './names';
import { RejectedNotice } from './RejectedNotice';

function ActionCard(props: { item: ActionItem; props: PhaseViewProps }) {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const { item } = props;
  const { state, isFacilitator } = props.props;
  // owners who are still in the session show with their current name, others with the stored one
  const owners = item.owners
    .map((o) =>
      state.participants[o.participantId]?.status === 'active'
        ? state.participants[o.participantId]!.displayName
        : o.name,
    )
    .join(', ');

  return (
    <li class="entry-card action-card" data-action-id={item.id}>
      {editing ? (
        <ActionForm
          state={state}
          initial={item}
          label={texts.contrib.actionEditForm}
          onCancel={() => setEditing(false)}
          onSubmit={(v) => {
            app.sendIntent('action.edit', {
              id: item.id,
              description: v.description,
              ownerIds: v.ownerIds,
              dueDate: v.dueDate || null,
            });
            setEditing(false);
          }}
        />
      ) : (
        <>
          <p class="entry-text">{item.description}</p>
          <p class="hint">{texts.contrib.ownersLabel(owners)}</p>
          {item.dueDate && <p class="hint">{texts.contrib.dueLabel(item.dueDate)}</p>}
          <div class="row entry-actions">
            <button type="button" aria-label={texts.contrib.editAction} onClick={() => setEditing(true)}>
              {texts.contrib.edit}
            </button>
            {isFacilitator && (
              <button
                type="button"
                aria-label={texts.contrib.deleteAction}
                onClick={() => app.sendIntent('action.delete', { id: item.id })}
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

/** Action items: anyone adds and edits, the Facilitator deletes. */
export function ActionsView(props: PhaseViewProps) {
  const app = useApp();
  const view = getContribView(props.state);
  return (
    <section class="contrib-actions" aria-label="Action items">
      <RejectedNotice />
      <ActionForm
        state={props.state}
        label={texts.contrib.actionNew}
        onSubmit={(v) =>
          app.sendIntent('action.add', {
            id: createUuid(),
            description: v.description,
            ownerIds: v.ownerIds,
            ...(v.dueDate ? { dueDate: v.dueDate } : {}),
          })
        }
      />
      <ul class="entry-list" aria-label="Action item list">
        {Object.values(view.actions)
          .sort(byCreated)
          .map((item) => (
            <ActionCard key={item.id} item={item} props={props} />
          ))}
      </ul>
    </section>
  );
}
