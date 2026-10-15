import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistries } from '../../src/core/registry';
import { viewFor } from '../../src/core/view';
import { registerContrib } from '../../src/contrib/register';
import { buildContributionSummary } from '../../src/contrib/summary';
import { getContrib, getContribView } from '../../src/contrib/types';
import { resetFlowRegistries } from '../../src/flow/registries';
import { A, B, F, makeState, must, remove, reveal } from './stateBuilder';

beforeEach(() => {
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
});
afterEach(() => {
  resetRegistries();
  resetFlowRegistries();
});

function session() {
  let s = makeState();
  s = must(s, B, 'entry.add', { id: 'cb', kind: 'checkIn', text: 'blake check-in' });
  s = must(s, B, 'entry.add', { id: 'rb', kind: 'retro', columnId: 'a', text: 'blake retro' });
  s = must(s, A, 'entry.add', { id: 'ra', kind: 'retro', columnId: 'a', text: 'alex retro' });
  s = must(s, B, 'note.add', { id: 'nb', text: 'blake note' });
  s = must(s, A, 'action.add', { id: 'a1', description: 'do', ownerIds: [A, B] });
  return reveal(reveal(s, 'checkIn'), 'retro');
}

describe('removal of a participant (AD-17, AC-23)', () => {
  it('their check-in responses and retro entries are in no view, also after the reveal, and not in the summary, but stay stored', () => {
    const s = remove(session(), B);
    for (const who of [A, F]) {
      const ids = Object.keys(getContribView(viewFor(s, who)).entries);
      expect(ids).toEqual(['ra']);
    }
    const summary = JSON.stringify(buildContributionSummary(s));
    expect(summary).not.toContain('blake check-in');
    expect(summary).not.toContain('blake retro');
    expect(Object.keys(getContrib(s).entries)).toContain('rb');
    expect(Object.keys(getContrib(s).entries)).toContain('cb');
  });

  it('note items they wrote and action items stay; their name stays on the action item as plain text', () => {
    const s = remove(session(), B);
    const v = getContribView(viewFor(s, A));
    expect(Object.keys(v.notes)).toEqual(['nb']);
    expect(v.actions.a1!.owners).toContainEqual({ participantId: B, name: 'Blake' });
    const sum = buildContributionSummary(s);
    expect(sum.actions[0]!.owners).toEqual(['Alex', 'Blake']);
    expect(sum.notes[0]!.text).toBe('blake note');
  });

  it('a participant who only left (offline, not removed) keeps all entries visible', () => {
    const s = session();
    s.participants[B] = { ...s.participants[B]!, presence: 'offline' };
    expect(Object.keys(getContribView(viewFor(s, A)).entries).sort()).toEqual(['cb', 'ra', 'rb']);
  });
});
