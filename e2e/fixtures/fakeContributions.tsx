// A stand-in for Epic 4 in the e2e build (VITE_E2E_FAKE_CONTRIBUTIONS=true): a content area with an
// "Add test entry" button, entries hidden from others until the phase is revealed, and the counters
// behind "N of M have added something". It only uses the registries of the flow module.
import { useApp } from '../../src/app/context';
import { getIntentHandler, registerIntentHandler, registerViewFilter } from '../../src/core/registry';
import type { SessionState } from '../../src/core/types';
import { getFlow } from '../../src/flow/flowState';
import { isRevealed } from '../../src/flow/flowView';
import {
  registerContributionCounter,
  registerPhaseView,
  type PhaseViewProps,
} from '../../src/flow/registries';
import { isRetro } from '../../src/flow/stops';

type Phase = 'checkIn' | 'retro';
interface Entry {
  by: string;
  text: string;
  phase: Phase;
}

const entriesOf = (state: SessionState): Record<string, Entry> =>
  ((state.extensions.fake as { entries?: Record<string, Entry> } | undefined)?.entries ?? {}) as Record<
    string,
    Entry
  >;

function count(state: SessionState, phase: Phase) {
  const authors = new Set(
    Object.values(entriesOf(state))
      .filter((e) => e.phase === phase)
      .map((e) => e.by),
  );
  return { added: authors.size, total: Object.keys(state.participants).length };
}

function FakeContent(props: PhaseViewProps) {
  const app = useApp();
  const entries = Object.entries(entriesOf(props.state));
  const phase: Phase = props.stop === 'checkIn' ? 'checkIn' : 'retro';
  const mine = entries.filter(([, e]) => e.by === app.myParticipantId.value && e.phase === phase).length;
  return (
    <section class="fake-contributions" aria-label="Test entries">
      <button
        type="button"
        onClick={() => app.sendIntent('fake.add', { text: `Entry ${mine + 1} (${phase})` })}
      >
        Add test entry
      </button>
      <ul aria-label="Entries">
        {entries
          .filter(([, e]) => e.phase === phase)
          .map(([id, e]) => (
            <li key={id}>
              <span class="entry-text">{e.text}</span> —{' '}
              <span class="entry-author">{props.state.participants[e.by]?.displayName ?? e.by}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

export function registerFakeContributions(): void {
  if (getIntentHandler('fake.add')) return;
  registerIntentHandler('fake.add', ({ state, senderId, payload, opId }) => {
    const text = (payload as { text?: unknown } | null)?.text;
    if (!senderId || typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'invalid' };
    const stop = getFlow(state).stop;
    const phase: Phase | null = stop === 'checkIn' ? 'checkIn' : isRetro(stop) ? 'retro' : null;
    if (!phase) return { ok: false, reason: 'wrong-stop' };
    const entries = { ...entriesOf(state), [opId]: { by: senderId, text: text.trim(), phase } };
    return { ok: true, state: { ...state, extensions: { ...state.extensions, fake: { entries } } } };
  });
  // others' entries stay hidden until the phase of the entry is revealed
  registerViewFilter((state, participantId) => {
    const visible = Object.fromEntries(
      Object.entries(entriesOf(state)).filter(
        ([, e]) => e.by === participantId || isRevealed(state, e.phase),
      ),
    );
    if (!state.extensions.fake) return state;
    return { ...state, extensions: { ...state.extensions, fake: { entries: visible } } };
  });
  registerContributionCounter('checkIn', (s) => count(s, 'checkIn'));
  registerContributionCounter('retro', (s) => count(s, 'retro'));
  registerPhaseView('checkIn', FakeContent);
  registerPhaseView('retro', FakeContent);
}
