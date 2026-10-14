import { useState } from 'preact/hooks';
import { texts } from '../texts';
import { copyText } from './copy';

/** A read-only value with a copy button (the value stays selectable when copying fails). */
export function CopyField(props: { label: string; value: string; copyLabel: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const id = `copy-${props.label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="copy-field">
      <label for={id}>{props.label}</label>
      <div class="row">
        <input
          id={id}
          type="text"
          readOnly
          value={props.value}
          onFocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        />
        <button
          type="button"
          aria-label={props.copyLabel}
          onClick={async () => setState((await copyText(props.value)) ? 'copied' : 'failed')}
        >
          {texts.copy}
        </button>
      </div>
      <p role="status" class="hint">
        {state === 'copied' ? texts.copied : state === 'failed' ? texts.copyFailed : ''}
      </p>
    </div>
  );
}
