// The five questions before a session is created (FR-2.1). Texts are English (NFR-5 of the PRD).

import type { Answers, Depth, Goal, Mood, Setting, TimeBudget } from './types';

export interface QuestionOption<V> {
  value: V;
  label: string;
}

export interface Question<K extends keyof Answers = keyof Answers> {
  /** The question ID used in the UI and the tests. */
  id: 'mood' | 'goal' | 'time' | 'depth' | 'setting';
  /** The key of the answer in `Answers`. */
  key: K;
  label: string;
  help: string;
  options: QuestionOption<Answers[K]>[];
}

type AnyQuestion =
  Question<'mood'> | Question<'goal'> | Question<'timeBudgetMin'> | Question<'depth'> | Question<'setting'>;

export const questionnaire: AnyQuestion[] = [
  {
    id: 'mood',
    key: 'mood',
    label: 'How is the team feeling today?',
    help: 'A tired or tense team does better with a gentle, short format.',
    options: [
      { value: 'energized' satisfies Mood, label: 'Energized' },
      { value: 'neutral' satisfies Mood, label: 'Neutral' },
      { value: 'tired' satisfies Mood, label: 'Tired' },
      { value: 'tense' satisfies Mood, label: 'Tense' },
    ],
  },
  {
    id: 'goal',
    key: 'goal',
    label: 'What is the goal of this retrospective?',
    help: 'Pick the one that matters most today.',
    options: [
      { value: 'fun' satisfies Goal, label: 'Have fun' },
      { value: 'bond' satisfies Goal, label: 'Bond as a team' },
      { value: 'reflect-period' satisfies Goal, label: 'Reflect on the period since the last retro' },
      { value: 'reflect-project' satisfies Goal, label: 'Reflect on a specific project' },
    ],
  },
  {
    id: 'time',
    key: 'timeBudgetMin',
    label: 'How much time do you have?',
    help: 'The whole session, from check-in to check-out.',
    options: [
      { value: 30 satisfies TimeBudget, label: '30 minutes' },
      { value: 50 satisfies TimeBudget, label: '50 minutes' },
      { value: 80 satisfies TimeBudget, label: '80 minutes' },
    ],
  },
  {
    id: 'depth',
    key: 'depth',
    label: 'How extensive should it be?',
    help: 'Lean means few steps and quick results. Extensive leaves room for deeper discussion.',
    options: [
      { value: 'lean' satisfies Depth, label: 'Lean' },
      { value: 'extensive' satisfies Depth, label: 'Extensive' },
    ],
  },
  {
    id: 'setting',
    key: 'setting',
    label: 'Where are you meeting?',
    help: 'Some formats work best when everybody is in the same room.',
    options: [
      { value: 'in-room' satisfies Setting, label: 'In the same room' },
      { value: 'remote' satisfies Setting, label: 'Remote' },
    ],
  },
];

export function isComplete(partial: Partial<Answers>): partial is Answers {
  return questionnaire.every((q) => partial[q.key] !== undefined);
}
