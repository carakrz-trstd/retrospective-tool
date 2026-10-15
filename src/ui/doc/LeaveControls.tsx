import { useApp } from '../../app/context';
import { texts } from '../../texts';
import { ConfirmDialog } from '../ConfirmDialog';

/** "Done": removes this session from the device; asks first, and warns when nothing was exported. */
export function LeaveControls(props: {
  exported: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const app = useApp();
  const t = texts.doc;
  return (
    <>
      <button type="button" onClick={() => props.onOpenChange(true)}>
        {t.done}
      </button>
      {props.open && (
        <ConfirmDialog
          title={props.exported ? t.leaveTitleExported : t.leaveTitleNothing}
          confirmLabel={props.exported ? t.leaveConfirmExported : t.leaveConfirmNothing}
          onCancel={() => props.onOpenChange(false)}
          onConfirm={() => {
            props.onOpenChange(false);
            app.leaveDocumentation();
          }}
        >
          <p class={props.exported ? '' : 'warning'}>{props.exported ? t.leaveExported : t.leaveNothing}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
