import type { FormatRef, TimeBudget } from './types';

/** Used until Epic 2 (format recommendation and library) provides the chosen format. */
export const placeholderFormat: FormatRef = {
  id: 'placeholder',
  name: 'Start, Stop, Continue',
  columns: [
    { id: 'start', name: 'Start' },
    { id: 'stop', name: 'Stop' },
    { id: 'continue', name: 'Continue' },
  ],
  checkInQuestion: 'In one word: how are you arriving today?',
};

export const placeholderTimeBudget: TimeBudget = 50;
