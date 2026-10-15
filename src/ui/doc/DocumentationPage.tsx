import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { texts } from '../../texts';
import { DocPreview } from './DocPreview';
import { ExportButtons } from './ExportButtons';
import { ExportStatus } from './ExportStatus';
import { LeaveControls } from './LeaveControls';

/** The screen after the session: warning, preview, exports, status and leaving. Replaces Epic 1's placeholder. */
export function DocumentationPage() {
  const app = useApp();
  const record = app.docRecord.value;
  const previewRef = useRef<HTMLElement>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const exported = record ? Object.values(record.exports).some(Boolean) : false;

  // while nothing is exported: the browser's own "leave this site?" warning, and a guard for the address bar
  useEffect(() => {
    if (exported) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onHash = () => {
      if (window.location.hash === '#/session') return;
      history.replaceState(null, '', '#/session');
      setLeaveOpen(true);
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('hashchange', onHash);
    };
  }, [exported]);

  if (!record) {
    return (
      <div class="page">
        <h2>{texts.endedHeading}</h2>
        <p role="status">{texts.doc.preparing}</p>
      </div>
    );
  }

  return (
    <div class="page doc-page">
      <h2>{texts.endedHeading}</h2>
      <div class="save-warning" role="alert">
        {texts.doc.saveWarning}
      </div>
      {record.model.incomplete && (
        <p class="note" role="status">
          {texts.doc.incompleteNote}
        </p>
      )}
      {!app.docPersisted.value && <p class="warning">{texts.doc.notStored}</p>}
      <DocPreview model={record.model} previewRef={previewRef} />
      <ExportButtons model={record.model} previewRef={previewRef} />
      <ExportStatus exports={record.exports} />
      <div class="row">
        <LeaveControls exported={exported} open={leaveOpen} onOpenChange={setLeaveOpen} />
      </div>
    </div>
  );
}
