import type { PhaseId, RetroStep } from '../formats/types';
import { STOP_IDS, type StopId } from './types';

export const STOPS: readonly StopId[] = STOP_IDS;

const PHASE_OF: Record<StopId, PhaseId> = {
  checkIn: 'checkIn',
  reviewActions: 'reviewActions',
  'retro.write': 'retro',
  'retro.reveal': 'retro',
  'retro.discuss': 'retro',
  notes: 'notes',
  actions: 'actions',
  checkOut: 'checkOut',
};

const STEP_OF: Partial<Record<StopId, RetroStep>> = {
  'retro.write': 'write',
  'retro.reveal': 'reveal',
  'retro.discuss': 'discuss',
};

const LABELS: Record<StopId, string> = {
  checkIn: 'Check-in',
  reviewActions: 'Review of previous action items',
  'retro.write': 'Retrospective: Write silently',
  'retro.reveal': 'Retrospective: Reveal',
  'retro.discuss': 'Retrospective: Discuss',
  notes: 'Discussion notes',
  actions: 'Action items',
  checkOut: 'Check-out',
};

export function stopToPhase(stop: StopId): PhaseId {
  return PHASE_OF[stop];
}

export function stopToStep(stop: StopId): RetroStep | undefined {
  return STEP_OF[stop];
}

export function isRetro(stop: StopId): boolean {
  return PHASE_OF[stop] === 'retro';
}

export function label(stop: StopId): string {
  return LABELS[stop];
}

export function next(stop: StopId): StopId {
  return STOPS[Math.min(STOPS.indexOf(stop) + 1, STOPS.length - 1)]!;
}

export function prev(stop: StopId): StopId {
  return STOPS[Math.max(STOPS.indexOf(stop) - 1, 0)]!;
}
