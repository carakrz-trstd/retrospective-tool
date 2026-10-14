import { describe, expect, it } from 'vitest';
import { questionnaire } from '../../src/formats/questionnaire';
import { PHASES, RETRO_STEPS } from '../../src/formats/types';

describe('questionnaire', () => {
  it('has exactly 5 questions with the IDs mood, goal, time, depth, setting', () => {
    expect(questionnaire.map((q) => q.id)).toEqual(['mood', 'goal', 'time', 'depth', 'setting']);
  });

  it('has exactly the specified options', () => {
    const options = (id: string) => questionnaire.find((q) => q.id === id)!.options.map((o) => o.value);
    expect(options('mood')).toEqual(['energized', 'neutral', 'tired', 'tense']);
    expect(options('goal')).toEqual(['fun', 'bond', 'reflect-period', 'reflect-project']);
    expect(options('time')).toEqual([30, 50, 80]);
    expect(options('depth')).toEqual(['lean', 'extensive']);
    expect(options('setting')).toEqual(['in-room', 'remote']);
  });

  it('every question has a label and a helper text, every option a label', () => {
    for (const q of questionnaire) {
      expect(q.label.length).toBeGreaterThan(0);
      expect(q.help.length).toBeGreaterThan(0);
      for (const o of q.options) expect(o.label.length).toBeGreaterThan(0);
    }
  });
});

describe('phase constants', () => {
  it('PHASES and RETRO_STEPS have the exact values', () => {
    expect(PHASES).toEqual(['checkIn', 'reviewActions', 'retro', 'notes', 'actions', 'checkOut']);
    expect(RETRO_STEPS).toEqual(['write', 'reveal', 'discuss']);
  });
});
