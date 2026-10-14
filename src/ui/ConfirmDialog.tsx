import type { ComponentChildren } from 'preact';
import { texts } from '../texts';

export function ConfirmDialog(props: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ComponentChildren;
}) {
  const titleId = 'dialog-title';
  return (
    <div class="dialog-backdrop">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{props.title}</h2>
        <div class="dialog-body">{props.children}</div>
        <div class="row">
          <button type="button" class="primary" onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
          <button type="button" onClick={props.onCancel}>
            {texts.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
