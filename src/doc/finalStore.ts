// The final documentation kept on this device (retro.final.<sessionId>) and which exports were done.
import { store as defaultStore, type Store } from '../storage/storage';
import { noExports, type DocumentModel, type ExportKind, type FinalRecord } from './model';

/** Saves the model (a later copy of the same model keeps the export marks). Returns false when it could not be stored. */
export function saveFinal(sessionId: string, model: DocumentModel, store: Store = defaultStore): boolean {
  const existing = store.loadFinalRecord<FinalRecord>(sessionId);
  return store.saveFinalRecord<FinalRecord>(sessionId, { model, exports: existing?.exports ?? noExports() });
}

export function loadFinal(sessionId: string, store: Store = defaultStore): FinalRecord | null {
  return store.loadFinalRecord<FinalRecord>(sessionId);
}

/** Marks an export as done; returns the updated record (null when there is none). */
export function markExported(
  sessionId: string,
  kind: ExportKind,
  store: Store = defaultStore,
): FinalRecord | null {
  const record = store.loadFinalRecord<FinalRecord>(sessionId);
  if (!record) return null;
  const next = { ...record, exports: { ...record.exports, [kind]: true } };
  store.saveFinalRecord<FinalRecord>(sessionId, next);
  return next;
}

export function removeFinal(sessionId: string, store: Store = defaultStore): void {
  store.removeFinalRecord(sessionId);
}
