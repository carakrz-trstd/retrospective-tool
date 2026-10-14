// Extension points for Epic 4: the content area of a stop, extra Facilitator controls and the
// counters behind "N of M have added something".
import { h, type ComponentType } from 'preact';
import type { SessionState } from '../core/types';
import type { PhaseId } from '../formats/types';
import { texts } from '../texts';
import { stopToPhase } from './stops';
import type { StopId } from './types';

export interface PhaseViewProps {
  stop: StopId;
  state: SessionState;
  isFacilitator: boolean;
  revealed: boolean;
}

export type PhaseKey = StopId | PhaseId;
export type CounterKey = 'checkIn' | 'retro';
export type ContributionCounter = (state: SessionState) => { added: number; total: number };

export const DefaultPhaseView: ComponentType<PhaseViewProps> = () =>
  h('p', { class: 'phase-placeholder' }, texts.flow.placeholder);

let views = new Map<PhaseKey, ComponentType<PhaseViewProps>>();
let controls: Array<{ key: PhaseKey; component: ComponentType<PhaseViewProps> }> = [];
let counters = new Map<CounterKey, ContributionCounter>();

export function registerPhaseView(key: PhaseKey, component: ComponentType<PhaseViewProps>): void {
  views.set(key, component);
}

/** The view of the exact stop, else of its phase, else the placeholder. */
export function getPhaseView(stop: StopId): ComponentType<PhaseViewProps> {
  return views.get(stop) ?? views.get(stopToPhase(stop)) ?? DefaultPhaseView;
}

export function registerPhaseControls(key: PhaseKey, component: ComponentType<PhaseViewProps>): void {
  controls.push({ key, component });
}

/** Controls registered for the stop or its phase, in registration order. */
export function getPhaseControls(stop: StopId): ComponentType<PhaseViewProps>[] {
  const phase = stopToPhase(stop);
  return controls.filter((c) => c.key === stop || c.key === phase).map((c) => c.component);
}

export function registerContributionCounter(key: CounterKey, fn: ContributionCounter): void {
  if (counters.has(key)) throw new Error(`Contribution counter already registered for "${key}"`);
  counters.set(key, fn);
}

export function getContributionCounter(key: CounterKey): ContributionCounter | undefined {
  return counters.get(key);
}

/** For tests. */
export function resetFlowRegistries(): void {
  views = new Map();
  controls = [];
  counters = new Map();
}
