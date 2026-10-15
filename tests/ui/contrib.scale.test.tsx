import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { contribSession, goTo, resetContrib } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

describe('the board with many entries (AC-19)', () => {
  it('8 participants x 40 entries render within a generous time budget; one change does not rebuild the other cards', async () => {
    const names = Array.from({ length: 7 }, (_, i) => `P${i + 1}`);
    const { host, people } = await contribSession({ participants: names });
    goTo(host, 'retro.write');
    host.t.app.flowIntent('flow.reveal', { key: 'retro' });
    const cols = host.t.app.state.value!.format.columns.map((c) => c.id);

    const started = performance.now();
    for (const [pi, p] of Object.values(people).entries()) {
      for (let i = 0; i < 40; i++) {
        p.t.app.sendIntent('entry.add', {
          id: `e-${pi}-${i}`,
          kind: 'retro',
          columnId: cols[i % cols.length],
          text: `entry ${pi}/${i}`,
        });
      }
    }
    for (let i = 0; i < 40; i++) {
      host.t.app.sendIntent('entry.add', {
        id: `e-f-${i}`,
        kind: 'retro',
        columnId: cols[i % cols.length],
        text: `entry f/${i}`,
      });
    }
    await host.q.findByText('entry 6/39', {}, { timeout: 10_000 });
    expect(host.container.querySelectorAll('li[data-entry-id]').length).toBe(8 * 40);
    expect(performance.now() - started).toBeLessThan(20_000);

    // one more entry: the existing cards keep their DOM nodes (keyed lists)
    const firstCard = host.container.querySelector('li[data-entry-id="e-0-0"]');
    expect(firstCard).toBeTruthy();
    people.P1!.t.app.sendIntent('entry.add', {
      id: 'extra',
      kind: 'retro',
      columnId: cols[0],
      text: 'one more',
    });
    await host.q.findByText('one more');
    expect(host.container.querySelector('li[data-entry-id="e-0-0"]')).toBe(firstCard);
  }, 60_000);
});
