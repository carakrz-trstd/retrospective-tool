import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, within } from '@testing-library/preact';
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

describe('Facilitator guide (AC-18)', () => {
  it('opens a dialog that says the Facilitator role cannot be handed over', async () => {
    const { host } = await runningSession();
    fireEvent.click(host.q.getByRole('button', { name: 'Facilitator guide' }));
    const dialog = await host.q.findByRole('dialog', { name: 'Facilitator guide' });
    expect(within(dialog).getByText(/cannot be handed to somebody else/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(host.q.queryByRole('dialog')).toBeNull();
  });

  it('participants have no guide button, and no control to hand over the role exists anywhere', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    expect(people.Alex!.q.queryByRole('button', { name: 'Facilitator guide' })).toBeNull();
    for (const d of [host, people.Alex!]) {
      expect(
        d.q.queryByRole('button', { name: /hand over|handover|transfer|make .* facilitator/i }),
      ).toBeNull();
    }
  });
});
