// Shared types and constants of the format library. The data shapes are defined once, as Zod
// schemas in schema.ts, and the TypeScript types are derived from them (one shared definition
// for library files and custom formats).

export const MOODS = ['energized', 'neutral', 'tired', 'tense'] as const;
export const GOALS = ['fun', 'bond', 'reflect-period', 'reflect-project'] as const;
export const DEPTHS = ['lean', 'extensive'] as const;
export const SETTINGS = ['in-room', 'remote'] as const;
export const TIME_BUDGETS = [30, 50, 80] as const;

export type Mood = (typeof MOODS)[number];
export type Goal = (typeof GOALS)[number];
export type Depth = (typeof DEPTHS)[number];
export type Setting = (typeof SETTINGS)[number];
export type TimeBudget = (typeof TIME_BUDGETS)[number];

/** The six phases of a session, in order (used by Epic 3). */
export const PHASES = ['checkIn', 'reviewActions', 'retro', 'notes', 'actions', 'checkOut'] as const;
export type PhaseId = (typeof PHASES)[number];

/** The three steps of the retro phase (used by Epic 3). */
export const RETRO_STEPS = ['write', 'reveal', 'discuss'] as const;
export type RetroStep = (typeof RETRO_STEPS)[number];

export type { Column, Format, TimeSplit } from './schema';

export interface Answers {
  mood: Mood;
  goal: Goal;
  timeBudgetMin: TimeBudget;
  depth: Depth;
  setting: Setting;
}

/** What the format selection hands over to session creation. */
export interface ChosenFormat {
  format: import('./schema').Format;
  timeBudgetMin: TimeBudget;
  answers?: Answers;
}
