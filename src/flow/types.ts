// Shared types of the guided session flow (Epic 3).

export const STOP_IDS = [
  'checkIn',
  'reviewActions',
  'retro.write',
  'retro.reveal',
  'retro.discuss',
  'notes',
  'actions',
  'checkOut',
] as const;
export type StopId = (typeof STOP_IDS)[number];

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  /** Host time (ms) at which the timer was last started; only while running. */
  startedAt?: number;
  /** Remaining ms at start (running) or at pause (paused); negative means overtime. */
  remainingMs?: number;
}

export interface FlowState {
  stop: StopId;
  timers: Partial<Record<StopId, TimerState>>;
  revealed: { checkIn: boolean; retro: boolean };
  soundMutedForAll: boolean;
}
