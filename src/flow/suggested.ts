// Suggested time per stop, from the format's time split (or the default shares as a fallback).
import { timeSplitFor } from '../formats/library';
import type { Format, TimeBudget } from '../formats/types';
import { getPhaseTexts } from './data/schema';
import { STOPS } from './stops';
import type { StopId } from './types';

const MIN = 60_000;

function fromSplit(split: NonNullable<ReturnType<typeof timeSplitFor>>): Record<StopId, number> {
  return {
    checkIn: split.checkIn,
    reviewActions: split.reviewActions,
    'retro.write': split.retro.write,
    'retro.reveal': split.retro.reveal,
    'retro.discuss': split.retro.discuss,
    notes: split.notes,
    actions: split.actions,
    checkOut: split.checkOut,
  };
}

/** defaultShare × budget in whole minutes; largest remainder so that the total is exact. */
function fromShares(budget: number): Record<StopId, number> {
  const t = getPhaseTexts();
  const share = (s: StopId): number => {
    if (s.startsWith('retro.')) return t.retroSteps.find((x) => x.id === s.slice(6))!.defaultShare;
    return t.phases.find((p) => p.id === s)!.defaultShare;
  };
  const raw = STOPS.map((s) => share(s) * budget);
  const floors = raw.map(Math.floor);
  let left = budget - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return Object.fromEntries(STOPS.map((s, i) => [s, floors[i]!])) as Record<StopId, number>;
}

function minutesFor(format: Format, budget: TimeBudget): Record<StopId, number> {
  const split = timeSplitFor(format, budget);
  return split ? fromSplit(split) : fromShares(budget);
}

export function suggestedMs(stop: StopId, format: Format, budget: TimeBudget): number {
  return minutesFor(format, budget)[stop] * MIN;
}

export function plannedTotalMs(format: Format, budget: TimeBudget): number {
  const m = minutesFor(format, budget);
  return STOPS.reduce((n, s) => n + m[s], 0) * MIN;
}
