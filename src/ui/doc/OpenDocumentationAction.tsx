import { useApp } from '../../app/context';
import { texts } from '../../texts';

/** In the 15-minute Facilitator-offline hint: build the documentation from what this device holds. */
export function OpenDocumentationAction() {
  const app = useApp();
  return (
    <button type="button" onClick={() => app.openIncompleteDocumentation()}>
      {texts.doc.openIncomplete}
    </button>
  );
}
