import { render, within } from '@testing-library/preact';
import { App } from '../../src/app/App';
import { buildDocumentModel } from '../../src/doc/build';
import { saveFinal } from '../../src/doc/finalStore';
import { noExports, type DocumentModel, type ExportMarks, type FinalRecord } from '../../src/doc/model';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp } from '../appHelpers';
import { sampleSession } from '../doc/sample';

/** An app that shows the documentation page of a finished sample session (no network involved). */
export function docApp(
  opts: {
    role?: 'host' | 'participant';
    incomplete?: boolean;
    exports?: Partial<ExportMarks>;
    special?: boolean;
    title?: string;
  } = {},
) {
  const state = sampleSession({ special: opts.special, title: opts.title });
  const t = makeApp(new MemoryNetwork());
  const model: DocumentModel = buildDocumentModel(state, { incomplete: opts.incomplete === true });
  const record: FinalRecord = { model, exports: { ...noExports(), ...opts.exports } };
  saveFinal(state.sessionId, model, t.device.store);
  t.device.store.saveFinalRecord(state.sessionId, record);
  t.app.state.set(state);
  t.app.role.set(opts.role ?? 'participant');
  t.app.openDocumentation(record, true);
  const view = render(<App controller={t.app} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  return {
    t,
    app: t.app,
    model,
    record,
    state,
    q: within(view.container as HTMLElement),
    container: view.container as HTMLElement,
  };
}
