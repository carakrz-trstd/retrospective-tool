import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { texts } from '../texts';

/** Name and role (both required), pre-filled from this device, with "forget me". */
export function PersonForm(props: {
  submitLabel: string;
  busyLabel: string;
  onSubmit: (value: { name: string; role: string; title: string }) => void;
  withTitle?: boolean;
  children?: ComponentChildren;
}) {
  const app = useApp();
  const identity = app.identity.value;
  const [name, setName] = useState(identity?.name ?? '');
  const [role, setRole] = useState(identity?.role ?? '');
  const [title, setTitle] = useState('');
  const error = app.formError.value;
  const busy = app.busy.value;

  return (
    <form
      class="person-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit({ name, role, title });
      }}
    >
      {props.children}
      <label for="person-name">{texts.nameLabel}</label>
      <input
        id="person-name"
        type="text"
        autocomplete="given-name"
        aria-required="true"
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <label for="person-role">{texts.roleLabel}</label>
      <input
        id="person-role"
        type="text"
        aria-required="true"
        value={role}
        onInput={(e) => setRole(e.currentTarget.value)}
      />
      {props.withTitle && (
        <>
          <label for="session-title">{texts.titleLabel}</label>
          <input
            id="session-title"
            type="text"
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
          <p class="hint">{texts.titleHelp}</p>
        </>
      )}
      {identity && (
        <p class="hint">
          {texts.forgetMeHelp}{' '}
          <button
            type="button"
            class="link"
            onClick={() => {
              app.forgetIdentity();
              setName('');
              setRole('');
            }}
          >
            {texts.forgetMe}
          </button>
        </p>
      )}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <div class="row">
        <button type="submit" class="primary" disabled={busy}>
          {busy ? props.busyLabel : props.submitLabel}
        </button>
        <button type="button" onClick={() => app.goHome()}>
          {texts.cancel}
        </button>
      </div>
    </form>
  );
}
