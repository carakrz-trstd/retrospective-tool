import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistries } from '../../src/core/registry';
import { viewFor } from '../../src/core/view';
import { registerContrib } from '../../src/contrib/register';
import { resetFlowRegistries } from '../../src/flow/registries';
import { A, B, F, makeState, must, remove } from './stateBuilder';

beforeEach(() => {
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
});
afterEach(() => {
  resetRegistries();
  resetFlowRegistries();
});

type Counts = Record<'checkIn' | 'retro', { added: number; total: number }>;
const countsFor = (s: ReturnType<typeof makeState>, who: string) =>
  (viewFor(s, who).extensions.flow as { counts?: Counts } | undefined)?.counts;

describe('contribution counters (AC-17 of Epic 3, FR-4.3)', () => {
  it('count distinct authors per kind, including hidden entries; total is the number of active participants', () => {
    let s = makeState();
    s = must(s, A, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'x' });
    s = must(s, A, 'entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'x' });
    s = must(s, A, 'entry.add', { id: 'r2', kind: 'retro', columnId: 'b', text: 'y' });
    s = must(s, B, 'entry.add', { id: 'r3', kind: 'retro', columnId: 'a', text: 'z' });
    const counts = countsFor(s, F)!;
    expect(counts.checkIn).toEqual({ added: 1, total: 3 });
    expect(counts.retro).toEqual({ added: 2, total: 3 });
  });

  it("a participant's view never contains the counts", () => {
    const s = must(makeState(), A, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'x' });
    expect(countsFor(s, A)).toBeUndefined();
    expect(countsFor(s, B)).toBeUndefined();
  });

  it('removed participants are not counted, and neither are their entries', () => {
    let s = makeState();
    s = must(s, A, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'x' });
    s = must(s, B, 'entry.add', { id: 'c2', kind: 'checkIn', text: 'y' });
    s = remove(s, B);
    expect(countsFor(s, F)!.checkIn).toEqual({ added: 1, total: 2 });
  });
});
