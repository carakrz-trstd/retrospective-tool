import { describe, expect, it, vi } from 'vitest';
import {
  addColumn,
  createCustomFromLibrary,
  createCustomFromScratch,
  moveColumn,
  removeColumn,
  renameColumn,
  setCheckIn,
  setPrompt,
  validateCustom,
} from '../../src/formats/custom';
import { defaults } from '../../src/formats/defaults';
import { splitTotal, type Format } from '../../src/formats/schema';
import { sampleFormat } from './sample';

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const v of Object.values(obj as object)) deepFreeze(v);
  }
  return obj;
}

function named(f: Format, names: string[]): Format {
  let result = f;
  names.forEach((name, i) => {
    result = renameColumn(result, result.columns[i]!.id, name);
  });
  return result;
}

const fiveColumns = () =>
  sampleFormat({
    columns: ['Keep', 'Less', 'More', 'Start', 'Stop'].map((n) => ({
      id: n.toLowerCase(),
      name: n,
      prompt: `${n}?`,
    })),
  });

describe('custom format from scratch', () => {
  it('has 2 columns, the first generic check-in question and is marked custom', () => {
    const f = createCustomFromScratch();
    expect(f.columns).toHaveLength(2);
    expect(f.checkInQuestion).toBe(defaults.checkInQuestions[0]);
    expect(f.custom).toBe(true);
    expect(f.id).toMatch(/^custom-[a-z0-9]+$/);
    expect(new Set(f.columns.map((c) => c.id)).size).toBe(2);
  });

  it('is not valid until the columns are named, and valid with 2 to 4 named columns (prompts optional)', () => {
    const f = createCustomFromScratch();
    expect(validateCustom(f).ok).toBe(false);
    const two = named(f, ['Ideas', 'Problems']);
    expect(validateCustom(two).ok).toBe(true);
    let four = two;
    for (let i = 0; i < 2; i++) {
      const added = addColumn(four);
      expect(added.ok).toBe(true);
      if (added.ok) four = added.format;
    }
    four = named(four, ['Ideas', 'Problems', 'Kudos', 'Questions']);
    expect(validateCustom(four).ok).toBe(true);
  });

  it('adding columns works up to 4 and the 5th is refused', () => {
    let f = createCustomFromScratch();
    for (let n = 3; n <= 4; n++) {
      const r = addColumn(f);
      expect(r.ok).toBe(true);
      if (r.ok) f = r.format;
      expect(f.columns).toHaveLength(n);
    }
    const fifth = addColumn(f);
    expect(fifth.ok).toBe(false);
    expect(f.columns).toHaveLength(4);
  });

  it('removing works down to 2 and the removal below 2 is refused', () => {
    let f = createCustomFromScratch();
    const added = addColumn(f);
    if (added.ok) f = added.format;
    const removed = removeColumn(f, f.columns[0]!.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) f = removed.format;
    expect(f.columns).toHaveLength(2);
    expect(removeColumn(f, f.columns[0]!.id).ok).toBe(false);
  });

  it('moving changes the order and keeps everything else', () => {
    const f = named(createCustomFromScratch(), ['First', 'Second']);
    const moved = moveColumn(f, f.columns[0]!.id, 1);
    expect(moved.columns.map((c) => c.name)).toEqual(['Second', 'First']);
    expect(moveColumn(moved, moved.columns[0]!.id, -1).columns.map((c) => c.name)).toEqual([
      'Second',
      'First',
    ]); // already first
  });

  it('the editing functions return new formats and never change their input', () => {
    const f = deepFreeze(createCustomFromScratch());
    expect(() => renameColumn(f, f.columns[0]!.id, 'X')).not.toThrow();
    expect(() => setPrompt(f, f.columns[0]!.id, 'Y')).not.toThrow();
    expect(() => moveColumn(f, f.columns[0]!.id, 1)).not.toThrow();
    expect(() => addColumn(f)).not.toThrow();
  });

  it('setCheckIn accepts only questions from the generic list', () => {
    const f = createCustomFromScratch();
    const ok = setCheckIn(f, defaults.checkInQuestions[2]!);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.format.checkInQuestion).toBe(defaults.checkInQuestions[2]);
    expect(setCheckIn(f, 'My own question?').ok).toBe(false);
  });

  it('the time splits equal the generic defaults and each sums to its duration', () => {
    const f = createCustomFromScratch();
    for (const k of ['30', '50', '80'] as const) {
      expect(f.timeSplits[k]).toEqual(defaults.timeSplits[k]);
      expect(splitTotal(f.timeSplits[k]!)).toBe(Number(k));
    }
  });

  it('never touches localStorage or sessionStorage', () => {
    const spies = [
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'getItem'),
      vi.spyOn(Storage.prototype, 'removeItem'),
    ];
    let f = createCustomFromScratch();
    f = named(f, ['A', 'B']);
    validateCustom(f);
    createCustomFromLibrary(sampleFormat());
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});

describe('"Use as basis" on a library format', () => {
  it('copies all 5 columns with new IDs and a new format ID, sets custom, and leaves the original untouched', () => {
    const original = deepFreeze(fiveColumns());
    const copy = createCustomFromLibrary(original);
    expect(copy.columns.map((c) => c.name)).toEqual(['Keep', 'Less', 'More', 'Start', 'Stop']);
    expect(copy.columns.map((c) => c.prompt)).toEqual(['Keep?', 'Less?', 'More?', 'Start?', 'Stop?']);
    expect(copy.custom).toBe(true);
    expect(copy.id).not.toBe(original.id);
    expect(copy.id).toMatch(/^custom-/);
    const oldIds = new Set(original.columns.map((c) => c.id));
    for (const c of copy.columns) expect(oldIds.has(c.id)).toBe(false);
    expect(copy.basedOn).toEqual({ id: original.id, columnCount: 5 });
    expect(original.columns).toHaveLength(5);
    expect(original.custom).toBeUndefined();
  });

  it('the copy can lose columns but not gain any while it has more than 4 (and not after reaching 4)', () => {
    let f = createCustomFromLibrary(fiveColumns());
    expect(addColumn(f).ok).toBe(false);
    expect(validateCustom(f).ok).toBe(true); // the unchanged 5-column copy is valid
    const removed = removeColumn(f, f.columns[4]!.id);
    expect(removed.ok).toBe(true);
    if (removed.ok) f = removed.format;
    expect(f.columns).toHaveLength(4);
    expect(addColumn(f).ok).toBe(false); // the limit is 4
    expect(validateCustom(f).ok).toBe(true);
  });

  it('gets the generic check-in question, the generic time splits and keeps the tips', () => {
    const original = fiveColumns();
    const copy = createCustomFromLibrary(original);
    expect(copy.checkInQuestion).toBe(defaults.checkInQuestions[0]);
    expect(copy.timeSplits).toEqual(defaults.timeSplits);
    expect(copy.facilitationTips).toEqual(original.facilitationTips);
  });

  it('renaming a copied column keeps the rest of the copy valid', () => {
    let f = createCustomFromLibrary(fiveColumns());
    f = renameColumn(f, f.columns[0]!.id, 'Keep going');
    expect(validateCustom(f).ok).toBe(true);
  });
});
