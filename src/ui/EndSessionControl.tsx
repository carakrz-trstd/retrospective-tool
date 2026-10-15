import { useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { texts } from '../texts';
import { ConfirmDialog } from './ConfirmDialog';

/** "End session" for the Facilitator, with the warnings of the end guards (for example hidden entries). */
export function EndSessionControl() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const state = app.state.value;
  if (!state || app.role.value !== 'host') return null;
  const messages = open ? app.endGuardMessages() : [];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={app.connection.value.readOnly}>
        {texts.endSession}
      </button>
      {open && (
        <ConfirmDialog
          title={texts.endTitle}
          confirmLabel={messages.length ? texts.endAnyway : texts.endConfirm}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            app.endSession();
          }}
        >
          {messages.map((m) => (
            <p key={m} class="warning">
              {m}
            </p>
          ))}
        </ConfirmDialog>
      )}
    </>
  );
}
