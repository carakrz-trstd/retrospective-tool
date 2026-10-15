import { describe, expect, it } from 'vitest';
import { buildContributionSummary } from '../../src/contrib/summary';
import { A, B, F, makeState, must, remove, reveal } from './stateBuilder';

function full() {
  let s = makeState();
  s = must(s, A, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'sleepy' }, 1_000);
  s = must(s, B, 'entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'start testing' }, 2_000);
  s = must(s, A, 'entry.add', { id: 'r2', kind: 'retro', columnId: 'b', text: 'stop meetings' }, 3_000);
  s = must(s, A, 'note.add', { id: 'n1', text: 'we agreed on X' }, 4_000);
  s = must(s, F, 'note.taker', { participantId: B });
  s = must(s, A, 'action.add', {
    id: 'x1',
    description: 'write docs',
    ownerIds: [A, B],
    dueDate: '2026-03-01',
  });
  s = must(s, null, 'survey.submit', {
    answerKey: 'k-secret-1',
    answer: { retroRating: 5, retroComment: 'great', toolRating: 4 },
  });
  s = must(s, null, 'survey.submit', {
    answerKey: 'k-secret-2',
    answer: { retroRating: 3, toolRating: 4, toolComment: 'fine' },
  });
  return s;
}

describe('buildContributionSummary (for the documentation)', () => {
  it('contains revealed check-in responses and retro entries per column with author names', () => {
    const s = reveal(reveal(full(), 'checkIn'), 'retro');
    const sum = buildContributionSummary(s);
    expect(sum.checkIn).toEqual([{ authorName: 'Alex', text: 'sleepy' }]);
    const a = sum.retro.find((c) => c.columnId === 'a')!;
    expect(a.entries).toEqual([{ authorName: 'Blake', text: 'start testing' }]);
    expect(sum.retro.find((c) => c.columnId === 'b')!.entries[0]!.authorName).toBe('Alex');
    expect(sum.retro.map((c) => c.columnId)).toEqual(['a', 'b', 'c']);
  });

  it('contains notes with the note taker, actions with owners as text and due dates, and survey results', () => {
    const sum = buildContributionSummary(reveal(full(), 'retro'));
    expect(sum.notes).toEqual([{ text: 'we agreed on X', authorName: 'Alex' }]);
    expect(sum.noteTaker).toBe('Blake');
    expect(sum.actions).toEqual([
      { description: 'write docs', owners: ['Alex', 'Blake'], dueDate: '2026-03-01' },
    ]);
    expect(sum.survey.count).toBe(2);
    expect(sum.survey.retro.average).toBe(4);
    expect(sum.survey.tool.average).toBe(4);
    expect(sum.survey.retro.comments).toEqual(['great']);
    expect(sum.survey.tool.comments).toEqual(['fine']);
    expect(sum.survey.retro.distribution).toEqual([0, 0, 1, 0, 1]);
  });

  it('unrevealed entries and entries of removed participants are not included', () => {
    const hidden = buildContributionSummary(full());
    expect(hidden.checkIn).toEqual([]);
    expect(hidden.retro.every((c) => c.entries.length === 0)).toBe(true);
    const removed = buildContributionSummary(remove(reveal(reveal(full(), 'checkIn'), 'retro'), B));
    expect(JSON.stringify(removed)).not.toContain('start testing');
    expect(removed.retro.find((c) => c.columnId === 'b')!.entries).toHaveLength(1);
  });

  it('no survey keys or participant IDs appear anywhere in the summary', () => {
    const json = JSON.stringify(buildContributionSummary(reveal(reveal(full(), 'checkIn'), 'retro')));
    expect(json).not.toContain('k-secret');
    for (const id of [F, A, B]) expect(json).not.toContain(id);
  });

  it('with no contributions the summary has empty lists and null averages', () => {
    const sum = buildContributionSummary(makeState());
    expect(sum.checkIn).toEqual([]);
    expect(sum.notes).toEqual([]);
    expect(sum.actions).toEqual([]);
    expect(sum.noteTaker).toBeUndefined();
    expect(sum.survey).toMatchObject({ count: 0, retro: { average: null }, tool: { average: null } });
  });
});
