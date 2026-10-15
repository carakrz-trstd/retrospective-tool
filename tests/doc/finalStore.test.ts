import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { loadFinal, markExported, removeFinal, saveFinal } from '../../src/doc/finalStore';
import { Store } from '../../src/storage/storage';
import { MemoryStorage, ThrowingStorage } from '../storageFakes';
import { sampleSession } from './sample';

const model = buildDocumentModel(sampleSession(), { incomplete: false });
const make = (local = new MemoryStorage(), now = () => Date.now()) => ({
  local,
  store: new Store({ local, session: new MemoryStorage(), now, expiryMs: 86_400_000 }),
});

describe('final record (AC-13, AC-14, AC-16)', () => {
  it('saveFinal then loadFinal returns the same model and no export marks', () => {
    const { store } = make();
    expect(saveFinal('S1', model, store)).toBe(true);
    expect(loadFinal('S1', store)).toEqual({
      model,
      exports: { markdown: false, rich: false, html: false, csv: false },
    });
    expect(loadFinal('other', store)).toBeNull();
  });

  it('markExported sets one mark and keeps the others; marks survive a reload', () => {
    const { local, store } = make();
    saveFinal('S1', model, store);
    markExported('S1', 'html', store);
    markExported('S1', 'csv', store);
    const reloaded = make(local).store;
    expect(loadFinal('S1', reloaded)!.exports).toEqual({
      markdown: false,
      rich: false,
      html: true,
      csv: true,
    });
  });

  it('saving the model again (re-sent after a rejoin) keeps the export marks', () => {
    const { store } = make();
    saveFinal('S1', model, store);
    markExported('S1', 'markdown', store);
    saveFinal('S1', model, store);
    expect(loadFinal('S1', store)!.exports.markdown).toBe(true);
  });

  it('removeFinal deletes the record, and removeSession deletes it too', () => {
    const { local, store } = make();
    saveFinal('S1', model, store);
    removeFinal('S1', store);
    expect(loadFinal('S1', store)).toBeNull();
    saveFinal('S2', model, store);
    expect(local.keys()).toContain('retro.final.S2');
    store.removeSession('S2');
    expect(local.keys().some((k) => k.startsWith('retro.final.'))).toBe(false);
  });

  it('ignores a record with an unknown schemaVersion', () => {
    const { local, store } = make();
    local.setItem(
      'retro.final.S1',
      JSON.stringify({ schemaVersion: 999, savedAt: Date.now(), data: { model, exports: {} } }),
    );
    expect(loadFinal('S1', store)).toBeNull();
  });

  it('the 24-hour sweep removes an old final record that was never left', () => {
    let now = 1_000_000;
    const { local, store } = make(new MemoryStorage(), () => now);
    saveFinal('S1', model, store);
    now += 25 * 60 * 60 * 1000;
    expect(store.sweepExpired()).toContain('S1');
    expect(local.keys().some((k) => k.startsWith('retro.final.'))).toBe(false);
  });

  it('a throwing localStorage does not crash: saving reports false, loading gives nothing', () => {
    const store = new Store({ local: new ThrowingStorage(), session: new MemoryStorage() });
    expect(saveFinal('S1', model, store)).toBe(false);
    expect(loadFinal('S1', store)).toBeNull();
    expect(() => markExported('S1', 'csv', store)).not.toThrow();
    expect(() => removeFinal('S1', store)).not.toThrow();
  });
});
