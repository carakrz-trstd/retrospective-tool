import { describe, expect, it } from 'vitest';
import type { Intent } from '../../src/core/protocol';
import { overlayState } from '../../src/contrib/overlay';
import { getContrib, getContribView } from '../../src/contrib/types';
import { A, B, makeState, must, reveal } from './stateBuilder';

const me = { participantId: A, isFacilitator: false };
const intent = (opId: string, kind: string, payload: unknown): Intent => ({ opId, kind, payload });
const add = (id: string, text = 'mine') =>
  intent(`op-${id}`, 'entry.add', { id, kind: 'retro', columnId: 'a', text });
const idsOf = (s: ReturnType<typeof makeState> | null) => Object.keys(getContribView(s!).entries).sort();

describe('overlay of unacknowledged intents (AD-12, AC-14, AC-20)', () => {
  it('shows the own entry from the outbox while the stored last state is unchanged', () => {
    const last = makeState();
    const before = JSON.stringify(last);
    const shown = overlayState(last, [add('e1')], me, 5_000);
    expect(idsOf(shown)).toEqual(['e1']);
    expect(getContrib(shown!).entries.e1).toMatchObject({ authorId: A, text: 'mine', createdAt: 5_000 });
    expect(JSON.stringify(last)).toBe(before);
  });

  it('after the acknowledgement the entry comes from the host state and is not shown twice', () => {
    const host = must(makeState(), A, 'entry.add', { id: 'e1', kind: 'retro', columnId: 'a', text: 'mine' });
    // acknowledged: gone from the outbox
    expect(idsOf(overlayState(host, [], me, 1))).toEqual(['e1']);
    // acknowledged on the host, outbox not yet cleaned: the same item, still once
    const twice = overlayState(host, [add('e1')], me, 1);
    expect(idsOf(twice)).toEqual(['e1']);
    expect(Object.keys(getContrib(twice!).entries)).toHaveLength(1);
  });

  it('a rejected intent is no longer in the outbox, so it disappears; an invalid one is not shown', () => {
    expect(idsOf(overlayState(makeState(), [], me, 1))).toEqual([]);
    expect(idsOf(overlayState(makeState(), [add('e1', 'x'.repeat(300))], me, 1))).toEqual([]);
  });

  it('edits and deletes of own entries are shown immediately', () => {
    const last = must(makeState(), A, 'entry.add', { id: 'e1', kind: 'retro', columnId: 'a', text: 'first' });
    const edited = overlayState(last, [intent('o2', 'entry.edit', { id: 'e1', text: 'second' })], me, 9_000);
    expect(getContrib(edited!).entries.e1!.text).toBe('second');
    const deleted = overlayState(last, [intent('o3', 'entry.delete', { id: 'e1' })], me, 9_000);
    expect(idsOf(deleted)).toEqual([]);
  });

  it("never shows other people's hidden entries and cannot change them", () => {
    // B's entry is hidden from A's view, so it is not in A's last state either
    const hostSide = must(makeState(), B, 'entry.add', {
      id: 'eb',
      kind: 'retro',
      columnId: 'a',
      text: 'secret',
    });
    expect(Object.keys(getContrib(hostSide).entries)).toEqual(['eb']);
    const aView = makeState();
    const shown = overlayState(aView, [intent('o1', 'entry.edit', { id: 'eb', text: 'hijack' })], me, 1);
    expect(idsOf(shown)).toEqual([]);
  });

  it('notes and actions written offline are shown too; the survey is not part of the overlay', () => {
    const shown = overlayState(
      makeState(),
      [
        intent('o1', 'note.add', { id: 'n1', text: 'a note' }),
        intent('o2', 'action.add', { id: 'x1', description: 'do it', ownerIds: [A] }),
        intent('o3', 'survey.submit', { answerKey: 'k', answer: { retroRating: 3, toolRating: 3 } }),
      ],
      me,
      1,
    );
    const v = getContribView(shown!);
    expect(Object.keys(v.notes)).toEqual(['n1']);
    expect(Object.keys(v.actions)).toEqual(['x1']);
    expect(v.survey.count).toBe(0);
  });

  it('works on a state after the reveal and with no state at all', () => {
    const revealed = reveal(makeState(), 'retro');
    expect(idsOf(overlayState(revealed, [add('e1')], me, 1))).toEqual(['e1']);
    expect(overlayState(null, [add('e1')], me, 1)).toBeNull();
  });
});
