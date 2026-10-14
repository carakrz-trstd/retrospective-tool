import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { registerContributionCounter, resetFlowRegistries } from '../../src/flow/registries';
import { runningSession } from './flowHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  resetFlowRegistries();
  localStorage.clear();
  vi.useRealTimers();
});

describe('contribution counter (AC-17)', () => {
  it('is shown to the Facilitator during the write steps only, never to participants', async () => {
    const { host, people } = await runningSession({ participants: ['Alex', 'Blake'], start: false });
    registerContributionCounter('checkIn', () => ({ added: 2, total: 3 }));
    registerContributionCounter('retro', () => ({ added: 1, total: 3 }));
    host.t.app.startSession();
    await host.q.findByText('2 of 3 have added something');
    for (const p of Object.values(people)) {
      await p.q.findByRole('heading', { name: /^Session/ });
      expect(p.q.queryByText(/have added something/)).toBeNull();
    }

    host.t.app.flowIntent('flow.goto', { stop: 'notes' });
    await host.q.findByText('Step 6 of 8', {}, { timeout: 100 }).catch(() => undefined);
    expect(host.q.queryByText(/have added something/)).toBeNull();

    host.t.app.flowIntent('flow.goto', { stop: 'retro.write' });
    await host.q.findByText('1 of 3 have added something');
    expect(people.Alex!.q.queryByText(/have added something/)).toBeNull();

    host.t.app.flowIntent('flow.goto', { stop: 'retro.discuss' });
    await vi.waitFor(() => expect(host.q.queryByText(/have added something/)).toBeNull());
  });
});
