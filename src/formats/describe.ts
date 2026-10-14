// Small helpers that turn format data into text for the screens.

import { questionnaire } from './questionnaire';
import type { Format, TimeSplit } from './schema';
import type { TimeBudget } from './types';
import { supportedBudgets } from './library';

/** The suggested minutes per phase, for display ("Check-in 5", "Retrospective 27 (write 8 ...)"). */
export function describeSplit(split: TimeSplit): { label: string; text: string }[] {
  const retro = split.retro.write + split.retro.reveal + split.retro.discuss;
  return [
    { label: 'Check-in', text: `${split.checkIn}` },
    { label: 'Review of previous action items', text: `${split.reviewActions}` },
    {
      label: 'Retrospective',
      text: `${retro} (write ${split.retro.write}, reveal ${split.retro.reveal}, discuss ${split.retro.discuss})`,
    },
    { label: 'Discussion notes', text: `${split.notes}` },
    { label: 'Action items', text: `${split.actions}` },
    { label: 'Check-out', text: `${split.checkOut}` },
  ];
}

export interface FormatTags {
  mood: string[];
  goal: string[];
  depth: string[];
  setting: string[];
  durations: TimeBudget[];
}

function labelOf(questionId: 'mood' | 'goal' | 'depth' | 'setting', value: string): string {
  const q = questionnaire.find((x) => x.id === questionId)!;
  return (q.options.find((o) => String(o.value) === value)?.label ?? value).toLowerCase();
}

/** The options a format fits well (weight 2 or more) in each dimension, plus its durations. */
export function formatTags(format: Format): FormatTags {
  const strong = <K extends 'mood' | 'goal' | 'depth' | 'setting'>(dim: K): string[] =>
    Object.entries(format.fit[dim])
      .filter(([, w]) => (w as number) >= 2)
      .map(([value]) => labelOf(dim, value));
  return {
    mood: strong('mood'),
    goal: strong('goal'),
    depth: strong('depth'),
    setting: strong('setting'),
    durations: supportedBudgets(format),
  };
}
