import type { Format, TimeSplit } from '../../src/formats/types';

export const split30: TimeSplit = {
  checkIn: 3,
  reviewActions: 3,
  retro: { write: 5, reveal: 3, discuss: 8 },
  notes: 2,
  actions: 4,
  checkOut: 2,
};
export const split50: TimeSplit = {
  checkIn: 5,
  reviewActions: 5,
  retro: { write: 8, reveal: 5, discuss: 14 },
  notes: 3,
  actions: 6,
  checkOut: 4,
};
export const split80: TimeSplit = {
  checkIn: 8,
  reviewActions: 7,
  retro: { write: 12, reveal: 8, discuss: 25 },
  notes: 5,
  actions: 9,
  checkOut: 6,
};

/** A valid format for tests (fresh copy on every call). */
export function sampleFormat(over: Partial<Format> = {}): Format {
  return structuredClone({
    id: 'sample-format',
    name: 'Sample Format',
    description: 'A format used in tests.',
    source: { name: 'funretrospectives.com', url: 'https://www.funretrospectives.com/' },
    columns: [
      { id: 'a', name: 'Alpha', prompt: 'What is alpha?' },
      { id: 'b', name: 'Beta' },
      { id: 'c', name: 'Gamma' },
    ],
    timeSplits: { 30: split30, 50: split50, 80: split80 },
    fit: {
      mood: { energized: 2, neutral: 2, tired: 1, tense: 1 },
      goal: { fun: 1, bond: 1, 'reflect-period': 3, 'reflect-project': 2 },
      depth: { lean: 2, extensive: 1 },
      setting: { 'in-room': 2, remote: 2 },
    },
    checkInQuestion: 'How are you arriving?',
    facilitationTips: ['Tip one.', 'Tip two.'],
    ...over,
  } as Format);
}
