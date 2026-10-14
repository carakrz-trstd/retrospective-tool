import { texts } from '../texts';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useApp } from './context';

/** Shown when the Facilitator opens a session that another tab of this browser hosts. */
export function TakeOverDialog() {
  const app = useApp();
  if (!app.takeOverPrompt.value) return null;
  return (
    <ConfirmDialog
      title={texts.takeOverTitle}
      confirmLabel={texts.takeOver}
      onConfirm={() => void app.confirmTakeOver()}
      onCancel={() => app.cancelTakeOver()}
    >
      <p>{texts.takeOverText}</p>
    </ConfirmDialog>
  );
}
