import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';
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

describe('flow shell (AC-1, AC-3, AC-5)', () => {
  it('the Facilitator sees Previous, Next, timer controls and the progress overview; a participant sees none of them', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    expect(host.q.getByRole('button', { name: 'Previous' })).toBeTruthy();
    expect(host.q.getByRole('button', { name: 'Next' })).toBeTruthy();
    expect(host.q.getByRole('button', { name: 'Start timer' })).toBeTruthy();
    expect(host.q.getByRole('navigation', { name: 'Session steps' })).toBeTruthy();

    const alex = people.Alex!;
    for (const name of ['Previous', 'Next', 'Start timer', 'Pause timer', 'Reset timer', 'Reveal']) {
      expect(alex.q.queryByRole('button', { name })).toBeNull();
    }
    expect(alex.q.queryByRole('navigation', { name: 'Session steps' })).toBeNull();
    expect(alex.q.getByText('Step 1 of 8')).toBeTruthy();
  });

  it('the stop list shows the six phases with the three retro steps under Retrospective', async () => {
    const { host } = await runningSession();
    const phases = [...host.container.querySelectorAll('[data-phase]')].map((e) =>
      e.getAttribute('data-phase'),
    );
    expect(phases).toEqual(['checkIn', 'reviewActions', 'retro', 'notes', 'actions', 'checkOut']);
    const steps = [...host.container.querySelectorAll('[data-phase="retro"] [data-stop]')].map((e) =>
      e.getAttribute('data-stop'),
    );
    expect(steps).toEqual(['retro.write', 'retro.reveal', 'retro.discuss']);
  });

  it('Next moves everybody through the stops and the participant label follows', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.next', {});
    await people.Alex!.q.findByText('Step 2 of 8');
    expect(host.container.querySelector('[data-stop="reviewActions"]')?.getAttribute('aria-current')).toBe(
      'step',
    );
  });
});
