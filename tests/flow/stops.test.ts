import { describe, expect, it } from 'vitest';
import { PHASES } from '../../src/formats/types';
import { STOPS, isRetro, label, next, prev, stopToPhase, stopToStep } from '../../src/flow/stops';

describe('stops', () => {
  it('are exactly the eight stops in the specified order', () => {
    expect(STOPS).toEqual([
      'checkIn',
      'reviewActions',
      'retro.write',
      'retro.reveal',
      'retro.discuss',
      'notes',
      'actions',
      'checkOut',
    ]);
  });

  it('map to the six phases in the fixed order (Check-in, Review, Retrospective, Notes, Actions, Check-out)', () => {
    const phases = STOPS.map(stopToPhase).filter((p, i, all) => all.indexOf(p) === i);
    expect(phases).toEqual([...PHASES]);
  });

  it('next and prev move along the list and stay at the ends', () => {
    expect(next('checkIn')).toBe('reviewActions');
    expect(next('retro.write')).toBe('retro.reveal');
    expect(next('checkOut')).toBe('checkOut');
    expect(prev('checkOut')).toBe('actions');
    expect(prev('retro.discuss')).toBe('retro.reveal');
    expect(prev('checkIn')).toBe('checkIn');
  });

  it('only the retro stops have a step', () => {
    expect(stopToStep('retro.write')).toBe('write');
    expect(stopToStep('retro.reveal')).toBe('reveal');
    expect(stopToStep('retro.discuss')).toBe('discuss');
    for (const s of ['checkIn', 'reviewActions', 'notes', 'actions', 'checkOut'] as const) {
      expect(stopToStep(s)).toBeUndefined();
      expect(isRetro(s)).toBe(false);
    }
    expect(isRetro('retro.reveal')).toBe(true);
  });

  it('labels exist for every stop', () => {
    for (const s of STOPS) expect(label(s).length).toBeGreaterThan(2);
    expect(label('retro.write')).toMatch(/Retrospective/);
    expect(label('checkIn')).toBe('Check-in');
  });
});
