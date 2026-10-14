import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { resetFlowRegistries } from '../../src/flow/registries';
import { runningSession } from './flowHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  resetFlowRegistries();
  localStorage.clear();
  vi.useRealTimers();
});

describe('reveal note (AD-16)', () => {
  it('after Next from the write step the Facilitator sees the note; participants do not', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.goto', { stop: 'retro.write' });
    await host.q.findByRole('button', { name: 'Reveal' });
    expect(host.q.queryByText('Everybody can now see the entries')).toBeNull();
    fireEvent.click(host.q.getByRole('button', { name: 'Next' }));
    await host.q.findByText('Everybody can now see the entries');
    expect(people.Alex!.q.queryByText('Everybody can now see the entries')).toBeNull();
    expect(host.t.app.state.value!.extensions.flow).toMatchObject({
      stop: 'retro.reveal',
      revealed: { retro: true },
    });
  });

  it('the note is not shown after the explicit Reveal button, and goes away when moving on', async () => {
    const { host } = await runningSession();
    host.t.app.flowIntent('flow.goto', { stop: 'retro.write' });
    fireEvent.click(await host.q.findByRole('button', { name: 'Reveal' }));
    await host.q.findByText(/Retrospective: Reveal/);
    expect(host.q.queryByText('Everybody can now see the entries')).toBeNull();
    // the Reveal button is disabled once revealed
    expect((host.q.getByRole('button', { name: 'Reveal' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
