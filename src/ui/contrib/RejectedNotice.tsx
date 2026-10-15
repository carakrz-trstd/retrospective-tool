import { useApp } from '../../app/context';
import { CONTRIB_INTENTS } from '../../contrib/reducer';
import { texts } from '../../texts';

/** A short message when the host refused one of the person's changes. */
export function RejectedNotice() {
  const app = useApp();
  const fresh = app.rejectedOps.value
    .slice(app.rejectedSeen.value)
    .filter((op) => CONTRIB_INTENTS.includes(op.kind));
  const last = fresh[fresh.length - 1];
  if (!last) return null;
  return (
    <div class="note" role="alert">
      <span>{texts.contrib.couldNotSave(last.reason)}</span>{' '}
      <button type="button" onClick={() => app.dismissRejected()}>
        {texts.contrib.dismiss}
      </button>
    </div>
  );
}
