import { useApp } from '../app/context';
import { texts } from '../texts';

/**
 * Placeholder for the documentation screen (Epic 5). `onLeaveDocumentation` is the hook Epic 5
 * calls when a person has left the documentation after exporting or confirming: it removes
 * everything this device keeps for the session.
 */
export function EndedPage() {
  const app = useApp();
  return (
    <div class="page">
      <h2>{texts.endedHeading}</h2>
      <p>{texts.endedText}</p>
      <button type="button" class="primary" onClick={() => onLeaveDocumentation(app)}>
        {texts.leaveEnded}
      </button>
    </div>
  );
}

export function onLeaveDocumentation(app: { finishEnded(): void }): void {
  app.finishEnded();
}
