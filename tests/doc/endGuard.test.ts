import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectEndGuardMessages, resetRegistries } from '../../src/core/registry';
import { registerContrib } from '../../src/contrib/register';
import { buildDocumentModel } from '../../src/doc/build';
import { registerDocEnd } from '../../src/doc/endIntegration';
import { resetFlowRegistries } from '../../src/flow/registries';
import { A, B, F, makeState, must, remove, reveal } from '../contrib/stateBuilder';
import { CAROL } from './sample';

beforeEach(() => {
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
  registerDocEnd();
});
afterEach(() => {
  resetRegistries();
  resetFlowRegistries();
});

function withCarol() {
  const s = makeState();
  s.participants[CAROL] = { ...s.participants[B]!, id: CAROL, name: 'Carol', displayName: 'Carol' };
  return s;
}

describe('hidden entries when the session ends (AC-19)', () => {
  it('names the number of hidden entries, not counting those of removed participants', () => {
    let s = withCarol();
    s = must(s, A, 'entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'hidden retro' });
    s = must(s, B, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'hidden check-in' });
    s = must(s, CAROL, 'entry.add', { id: 'r2', kind: 'retro', columnId: 'b', text: 'by carol' });
    s = remove(s, CAROL);
    expect(collectEndGuardMessages(s)).toEqual([
      '2 entries are still hidden and will not be in the documentation. Cancel and use Reveal first, or end the session anyway.',
    ]);
  });

  it('says "1 entry is" for one entry and nothing when everything is revealed or there are none', () => {
    let s = must(makeState(), A, 'entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'x' });
    expect(collectEndGuardMessages(s)[0]).toMatch(
      /^1 entry is still hidden and will not be in the documentation\./,
    );
    expect(collectEndGuardMessages(reveal(s, 'retro'))).toEqual([]);
    expect(collectEndGuardMessages(makeState())).toEqual([]);
    s = must(s, F, 'entry.add', { id: 'c1', kind: 'checkIn', text: 'y' });
    expect(collectEndGuardMessages(reveal(s, 'retro'))[0]).toMatch(/^1 entry is still hidden/);
  });

  it('registering twice does not repeat the message', () => {
    registerDocEnd();
    const s = must(makeState(), A, 'entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'x' });
    expect(collectEndGuardMessages(s)).toHaveLength(1);
  });

  it('entries that stay hidden are not in the documentation', () => {
    const running = must(makeState(), A, 'entry.add', {
      id: 'r1',
      kind: 'retro',
      columnId: 'a',
      text: 'never revealed',
    });
    const model = buildDocumentModel({ ...running, status: 'ended' }, { incomplete: false });
    expect(JSON.stringify(model)).not.toContain('never revealed');
  });
});
