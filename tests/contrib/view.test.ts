import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistries } from '../../src/core/registry';
import { viewFor } from '../../src/core/view';
import { registerContrib } from '../../src/contrib/register';
import { getContribView } from '../../src/contrib/types';
import { resetFlowRegistries } from '../../src/flow/registries';
import { A, B, F, makeState, must, reveal } from './stateBuilder';

beforeEach(() => {
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
});
afterEach(() => {
  resetRegistries();
  resetFlowRegistries();
});

const retro = (id: string, text = 't') => ({ id, kind: 'retro', columnId: 'a', text });
const checkIn = (id: string, text = 'c') => ({ id, kind: 'checkIn', text });

function twoEntries() {
  let s = makeState();
  s = must(s, A, 'entry.add', retro('ea', 'from A'));
  s = must(s, B, 'entry.add', retro('eb', 'from B'));
  s = must(s, F, 'entry.add', retro('ef', 'from F'));
  return s;
}
const idsFor = (s: ReturnType<typeof makeState>, who: string) =>
  Object.keys(getContribView(viewFor(s, who)).entries).sort();

describe('contribution view filter (AC-3, AC-4, AC-5, AC-13, AC-16)', () => {
  it('before the reveal everybody, also the Facilitator, sees only their own entries', () => {
    const s = twoEntries();
    expect(idsFor(s, B)).toEqual(['eb']);
    expect(idsFor(s, A)).toEqual(['ea']);
    expect(idsFor(s, F)).toEqual(['ef']);
  });

  it('after the reveal everybody sees all entries with their authorId', () => {
    const s = reveal(twoEntries(), 'retro');
    expect(idsFor(s, B)).toEqual(['ea', 'eb', 'ef']);
    expect(getContribView(viewFor(s, B)).entries.ea!.authorId).toBe(A);
  });

  it('check-in and retro are revealed independently', () => {
    let s = twoEntries();
    s = must(s, A, 'entry.add', checkIn('ca'));
    s = reveal(s, 'checkIn');
    expect(idsFor(s, B)).toEqual(['ca', 'eb']);
    s = reveal(s, 'retro');
    expect(idsFor(s, B)).toEqual(['ca', 'ea', 'eb', 'ef']);
  });

  it("an entry added after the reveal is in everybody's view; going back keeps the flag so nothing is hidden again", () => {
    let s = reveal(twoEntries(), 'retro');
    s = must(s, A, 'entry.add', retro('late'));
    expect(idsFor(s, B)).toContain('late');
    expect(idsFor(s, B)).toHaveLength(4);
  });

  it('notes, actions and the note taker are in every view', () => {
    let s = makeState();
    s = must(s, A, 'note.add', { id: 'n1', text: 'note' });
    s = must(s, A, 'action.add', { id: 'a1', description: 'do it', ownerIds: [A] });
    s = must(s, F, 'note.taker', { participantId: B });
    const v = getContribView(viewFor(s, B));
    expect(Object.keys(v.notes)).toEqual(['n1']);
    expect(Object.keys(v.actions)).toEqual(['a1']);
    expect(v.noteTakerId).toBe(B);
  });

  it('while the survey is open the view has only closed:false and the count, never answers or keys', () => {
    let s = makeState();
    s = must(s, null, 'survey.submit', {
      answerKey: 'secret-key-1',
      answer: { retroRating: 4, toolRating: 5 },
    });
    s = must(s, null, 'survey.submit', {
      answerKey: 'secret-key-2',
      answer: { retroRating: 2, toolRating: 3 },
    });
    const view = viewFor(s, A);
    const survey = getContribView(view).survey;
    expect(survey).toEqual({ closed: false, count: 2 });
    expect(JSON.stringify(view)).not.toContain('secret-key');
  });

  it('once closed (or the session has ended) the answers are in the view, ordered independently of submission order, without keys', () => {
    let s = makeState();
    const answers = [5, 1, 3, 2, 4].map((r) => ({ retroRating: r, toolRating: r }));
    answers.forEach((a, i) => (s = must(s, null, 'survey.submit', { answerKey: `key-${i}`, answer: a })));
    const closed = must(s, F, 'survey.close', {});
    const v = getContribView(viewFor(closed, A)).survey;
    expect(v.closed).toBe(true);
    expect(v.answers).toHaveLength(5);
    expect(JSON.stringify(viewFor(closed, A))).not.toContain('key-');
    // the order does not follow the submission order (here: 5,1,3,2,4)
    expect(v.answers!.map((a) => a.retroRating)).not.toEqual([5, 1, 3, 2, 4]);
    // the order is stable: the same state gives the same list
    expect(getContribView(viewFor(closed, B)).survey.answers).toEqual(v.answers);

    const ended = { ...s, status: 'ended' as const };
    expect(getContribView(viewFor(ended, A)).survey.answers).toHaveLength(5);
  });

  it("the full state is never part of a participant's view", () => {
    const view = viewFor(reveal(twoEntries(), 'checkIn'), B);
    expect(JSON.stringify(view)).not.toContain('from A');
    expect(JSON.stringify(view)).not.toContain('from F');
    expect(JSON.stringify(view)).toContain('from B');
  });

  it('a state without contributions gives an empty view of a stable shape (so a hidden entry later changes nothing for others)', () => {
    const v = getContribView(viewFor(makeState(), A));
    expect(v).toEqual({ entries: {}, notes: {}, actions: {}, survey: { closed: false, count: 0 } });
  });
});
