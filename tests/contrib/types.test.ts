import { describe, expect, it } from 'vitest';
import { getContrib, getContribView } from '../../src/contrib/types';
import { makeState } from './stateBuilder';

describe('getContrib', () => {
  it('returns an empty slice for a state without extensions.contrib', () => {
    const c = getContrib(makeState());
    expect(c).toEqual({ entries: {}, notes: {}, actions: {}, survey: { closed: false, answers: {} } });
  });

  it('returns the stored slice otherwise', () => {
    const s = makeState();
    s.extensions.contrib = {
      entries: { e1: { id: 'e1' } },
      notes: {},
      actions: {},
      noteTakerId: 'x',
      survey: { closed: true, answers: {} },
    };
    const c = getContrib(s);
    expect(Object.keys(c.entries)).toEqual(['e1']);
    expect(c.noteTakerId).toBe('x');
    expect(c.survey.closed).toBe(true);
  });

  it('getContribView gives the survey as { closed, count } and the answers only when present as a list', () => {
    const s = makeState();
    s.extensions.contrib = { survey: { closed: false, count: 3 } };
    expect(getContribView(s).survey).toEqual({ closed: false, count: 3 });
    s.extensions.contrib = { survey: { closed: true, answers: { k1: {}, k2: {} } } };
    expect(getContribView(s).survey.count).toBe(2);
  });
});
