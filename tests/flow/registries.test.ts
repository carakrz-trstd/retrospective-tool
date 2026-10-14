import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'preact';
import {
  DefaultPhaseView,
  getPhaseControls,
  getPhaseView,
  registerContributionCounter,
  registerPhaseControls,
  registerPhaseView,
  resetFlowRegistries,
} from '../../src/flow/registries';

afterEach(() => resetFlowRegistries());

const A = () => h('div', null, 'A');
const B = () => h('div', null, 'B');
const C = () => h('div', null, 'C');

describe('flow registries', () => {
  it('returns the default placeholder when nothing is registered', () => {
    expect(getPhaseView('checkIn')).toBe(DefaultPhaseView);
  });

  it('returns a view registered for the phase or for the exact stop (stop wins)', () => {
    registerPhaseView('retro', A);
    registerPhaseView('retro.reveal', B);
    expect(getPhaseView('retro.write')).toBe(A);
    expect(getPhaseView('retro.discuss')).toBe(A);
    expect(getPhaseView('retro.reveal')).toBe(B);
    expect(getPhaseView('notes')).toBe(DefaultPhaseView);
  });

  it('returns phase controls in registration order, for the stop and its phase', () => {
    registerPhaseControls('checkOut', A);
    registerPhaseControls('checkOut', B);
    registerPhaseControls('retro', C);
    expect(getPhaseControls('checkOut')).toEqual([A, B]);
    expect(getPhaseControls('retro.write')).toEqual([C]);
    expect(getPhaseControls('notes')).toEqual([]);
  });

  it('registering a counter for the same key twice throws', () => {
    registerContributionCounter('retro', () => ({ added: 0, total: 0 }));
    expect(() => registerContributionCounter('retro', () => ({ added: 0, total: 0 }))).toThrow(/already/);
  });
});
