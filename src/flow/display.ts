// The display model of the timer of the current stop.
import type { ClientStatus } from '../client/ClientController';
import { timerView, IDLE, type TimerViewModel } from './timer';
import type { FlowState, StopId } from './types';

export interface TimerDisplay extends TimerViewModel {
  stop: StopId;
  durationMs: number;
  /** True while the Facilitator is offline: the time keeps counting from the last known estimate. */
  notSynchronized: boolean;
}

export function timerDisplay(
  flow: FlowState,
  durationOf: (stop: StopId) => number,
  hostNow: number,
  connection: ClientStatus | 'host',
): TimerDisplay {
  const durationMs = durationOf(flow.stop);
  const view = timerView(flow.timers[flow.stop] ?? IDLE, durationMs, hostNow);
  return { ...view, stop: flow.stop, durationMs, notSynchronized: connection === 'facilitator-offline' };
}
