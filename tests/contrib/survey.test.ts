import { describe, expect, it } from 'vitest';
import { aggregate } from '../../src/contrib/survey';
import { getContrib } from '../../src/contrib/types';
import { A, F, makeState, must, reason } from './stateBuilder';

const answer = (over: object = {}) => ({ retroRating: 4, toolRating: 5, ...over });
const submit = (key: string, a: object = answer()) => ({ answerKey: key, answer: a });

describe('survey rules (AC-11, AC-12, AC-21, AC-22)', () => {
  it('a valid answer is stored under its key; the same key replaces; two keys count 2', () => {
    let s = must(makeState(), null, 'survey.submit', submit('k1'));
    expect(getContrib(s).survey.answers.k1).toMatchObject({ retroRating: 4, toolRating: 5 });
    s = must(s, null, 'survey.submit', submit('k1', answer({ retroRating: 2 })));
    expect(Object.keys(getContrib(s).survey.answers)).toEqual(['k1']);
    expect(getContrib(s).survey.answers.k1!.retroRating).toBe(2);
    s = must(s, null, 'survey.submit', submit('k2'));
    expect(Object.keys(getContrib(s).survey.answers)).toHaveLength(2);
  });

  it('ratings outside 1-5 or not whole numbers are rejected; both ratings are required; comments optional', () => {
    const s = makeState();
    for (const bad of [0, 6, 2.5, '3', null]) {
      expect(reason(s, null, 'survey.submit', submit('k', answer({ retroRating: bad })))).toBe(
        'invalid-answer',
      );
    }
    expect(reason(s, null, 'survey.submit', submit('k', { toolRating: 3 }))).toBe('invalid-answer');
    expect(reason(s, null, 'survey.submit', submit('k', { retroRating: 3 }))).toBe('invalid-answer');
    expect(
      reason(s, null, 'survey.submit', submit('k', answer({ retroComment: '', toolComment: '  ' }))),
    ).toBeNull();
  });

  it('comments: 500 characters accepted, 501 rejected', () => {
    const s = makeState();
    expect(
      reason(s, null, 'survey.submit', submit('k', answer({ toolComment: 'x'.repeat(500) }))),
    ).toBeNull();
    expect(reason(s, null, 'survey.submit', submit('k', answer({ retroComment: 'x'.repeat(501) })))).toBe(
      'too-long',
    );
  });

  it('submissions after close and after the session ended are rejected', () => {
    const closed = must(makeState(), F, 'survey.close', {});
    expect(reason(closed, null, 'survey.submit', submit('k'))).toBe('survey-closed');
    expect(reason(makeState({ status: 'ended' }), null, 'survey.submit', submit('k'))).toBe('survey-closed');
  });

  it('close is Facilitator-only and idempotent', () => {
    const s = makeState();
    expect(reason(s, A, 'survey.close', {})).toBe('not-facilitator');
    const once = must(s, F, 'survey.close', {});
    const twice = must(once, F, 'survey.close', {});
    expect(getContrib(twice).survey.closed).toBe(true);
  });

  it('aggregate: count, one-decimal averages, distribution and comments; null averages without answers', () => {
    const r = aggregate([
      { retroRating: 5, toolRating: 3, retroComment: 'great' },
      { retroRating: 4, toolRating: 4, toolComment: 'ok' },
      { retroRating: 4, toolRating: 4 },
    ]);
    expect(r.count).toBe(3);
    expect(r.retro.average).toBe(4.3);
    expect(r.tool.average).toBe(3.7);
    expect(r.retro.distribution).toEqual([0, 0, 0, 2, 1]);
    expect(r.tool.distribution).toEqual([0, 0, 1, 2, 0]);
    expect(r.retro.comments).toEqual(['great']);
    expect(r.tool.comments).toEqual(['ok']);
    const none = aggregate([]);
    expect(none).toMatchObject({ count: 0, retro: { average: null }, tool: { average: null } });
  });

  it('no stored object contains a participant ID', () => {
    const s = must(makeState(), null, 'survey.submit', submit('k1'));
    const json = JSON.stringify(getContrib(s));
    for (const id of Object.keys(s.participants)) expect(json).not.toContain(id);
  });
});
