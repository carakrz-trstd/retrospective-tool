import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/preact';
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

describe('progress overview (AC-13)', () => {
  it('each stop shows its planned minutes and its used time, and the total shows used versus planned', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host } = await runningSession();
    const stop = (id: string) => host.container.querySelector(`[data-stop="${id}"]`)!;
    expect(stop('checkIn').textContent).toMatch(/5 min planned/);
    expect(stop('retro.discuss').textContent).toMatch(/14 min planned/);
    expect(stop('checkOut').textContent).toMatch(/4 min planned/);
    expect(stop('checkIn').textContent).toMatch(/used 0:00/);
    expect(host.q.getByText('Used 0 min of 50 min planned')).toBeTruthy();

    host.t.app.flowIntent('flow.timer', { action: 'start' });
    await act(() => void vi.advanceTimersByTime(2 * 60_000 + 5_000));
    await waitFor(() => expect(stop('checkIn').textContent).toMatch(/used 2:05/));
    expect(host.q.getByText('Used 2 min of 50 min planned')).toBeTruthy();
  });

  it('selecting a stop moves everybody there (flow.goto)', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    fireEvent.click(
      host.container.querySelector('[data-stop="retro.discuss"] button, button[data-stop="retro.discuss"]')!,
    );
    await people.Alex!.q.findByText('Step 5 of 8');
    expect(host.t.app.state.value!.extensions.flow).toMatchObject({ stop: 'retro.discuss' });
  });
});
