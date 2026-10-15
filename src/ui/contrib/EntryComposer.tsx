import { useState } from 'preact/hooks';
import { ENTRY_MAX, normalizeText, truncate } from '../../contrib/limits';
import { texts } from '../../texts';
import { CharCounter } from './CharCounter';

/** A text field with a counter and an Add button. The input stops at the limit. */
export function EntryComposer(props: {
  fieldLabel: string;
  addLabel: string;
  onAdd: (text: string) => void;
  max?: number;
  rows?: number;
}) {
  const max = props.max ?? ENTRY_MAX;
  const [text, setText] = useState('');
  const empty = normalizeText(text) === '';
  return (
    <form
      class="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (empty) return;
        props.onAdd(normalizeText(text));
        setText('');
      }}
    >
      <textarea
        aria-label={props.fieldLabel}
        rows={props.rows ?? 2}
        value={text}
        onInput={(e) => {
          const field = e.currentTarget;
          const cut = truncate(field.value, max);
          // also when the state does not change (already at the limit), the field must not grow
          if (field.value !== cut) field.value = cut;
          setText(cut);
        }}
      />
      <div class="row composer-row">
        <CharCounter text={text} max={max} />
        <button type="submit" class="primary" aria-label={props.addLabel} disabled={empty}>
          {texts.contrib.add}
        </button>
      </div>
    </form>
  );
}
