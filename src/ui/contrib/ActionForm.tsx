import { useState } from 'preact/hooks';
import { ACTION_DESCRIPTION_MAX, normalizeText, truncate } from '../../contrib/limits';
import type { ActionItem } from '../../contrib/types';
import type { SessionState } from '../../core/types';
import { texts } from '../../texts';
import { CharCounter } from './CharCounter';
import { activeParticipants } from './names';

export interface ActionValues {
  description: string;
  ownerIds: string[];
  dueDate: string;
}

/** Description, owners from the session (at least one) and an optional due date. */
export function ActionForm(props: {
  state: SessionState;
  initial?: ActionItem;
  label: string;
  onSubmit: (values: ActionValues) => void;
  onCancel?: () => void;
}) {
  const [description, setDescription] = useState(props.initial?.description ?? '');
  const [owners, setOwners] = useState<string[]>(props.initial?.owners.map((o) => o.participantId) ?? []);
  const [due, setDue] = useState(props.initial?.dueDate ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  // people who are in the session, plus owners the item already has (they stay, as plain names)
  const choices = [
    ...activeParticipants(props.state).map((p) => ({ id: p.id, name: p.displayName })),
    ...(props.initial?.owners ?? [])
      .filter((o) => props.state.participants[o.participantId]?.status !== 'active')
      .map((o) => ({ id: o.participantId, name: o.name })),
  ];

  const submit = (e: Event) => {
    e.preventDefault();
    const problems: string[] = [];
    if (!normalizeText(description)) problems.push(texts.contrib.actionDescriptionRequired);
    if (owners.length === 0) problems.push(texts.contrib.actionOwnerRequired);
    setErrors(problems);
    if (problems.length > 0) return;
    props.onSubmit({
      description: normalizeText(description),
      ownerIds: choices.filter((c) => owners.includes(c.id)).map((c) => c.id),
      dueDate: due,
    });
    if (!props.initial) {
      setDescription('');
      setOwners([]);
      setDue('');
    }
  };

  return (
    <form class="action-form" aria-label={props.label} noValidate onSubmit={submit}>
      <textarea
        aria-label={texts.contrib.actionDescription}
        rows={2}
        value={description}
        onInput={(e) => {
          const cut = truncate(e.currentTarget.value, ACTION_DESCRIPTION_MAX);
          if (e.currentTarget.value !== cut) e.currentTarget.value = cut;
          setDescription(cut);
        }}
      />
      <CharCounter text={description} max={ACTION_DESCRIPTION_MAX} />
      <fieldset>
        <legend>{texts.contrib.actionOwners}</legend>
        {choices.map((c) => (
          <label key={c.id} class="option">
            <input
              type="checkbox"
              checked={owners.includes(c.id)}
              onChange={(e) =>
                setOwners(e.currentTarget.checked ? [...owners, c.id] : owners.filter((id) => id !== c.id))
              }
            />
            {c.name}
          </label>
        ))}
      </fieldset>
      <label>
        {texts.contrib.actionDue}
        <input type="date" value={due} onInput={(e) => setDue(e.currentTarget.value)} />
      </label>
      {errors.map((m) => (
        <p key={m} class="error" role="alert">
          {m}
        </p>
      ))}
      <div class="row">
        <button type="submit" class="primary">
          {texts.contrib.saveAction}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel}>
            {texts.contrib.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
