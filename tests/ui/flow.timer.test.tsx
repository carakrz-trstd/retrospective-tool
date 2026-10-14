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

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const timerText = (d: { q: { getByRole: (r: string) => HTMLElement } }) => d.q.getByRole('timer').textContent;

describe('timer widget (AC-8, AC-9, AC-10, AC-11, AC-16)', () => {
  it("shows the suggested time of the stop from the format's split and Start, Pause and Reset change the display", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, people } = await runningSession({ participants: ['Alex'] });
    expect(timerText(host)).toBe('5:00');
    expect(host.q.getByText('Suggested time: 5 min')).toBeTruthy();

    fireEvent.click(host.q.getByRole('button', { name: 'Start timer' }));
    await waitFor(() => expect(host.q.getByText('Running')).toBeTruthy());
    await advance(60_000);
    await waitFor(() => expect(timerText(host)).toBe('4:00'));
    await waitFor(() => expect(timerText(people.Alex!)).toBe('4:00'));

    fireEvent.click(host.q.getByRole('button', { name: 'Pause timer' }));
    await waitFor(() => expect(host.q.getByText('Paused')).toBeTruthy());
    await advance(30_000);
    expect(timerText(host)).toBe('4:00');

    fireEvent.click(host.q.getByRole('button', { name: 'Reset timer' }));
    await waitFor(() => expect(timerText(host)).toBe('5:00'));
    expect(host.q.getByText('Not started')).toBeTruthy();
  });

  it('at zero the "time is over" banner appears on every device, the beep plays once, and the overtime counts up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, people } = await runningSession({ participants: ['Alex'] });
    fireEvent.click(host.q.getByRole('button', { name: 'Start timer' }));
    await waitFor(() => expect(host.q.getByText('Running')).toBeTruthy());
    await advance(5 * 60_000 + 500);
    for (const d of [host, people.Alex!]) {
      await d.q.findByText('Time is over');
      expect(d.sound.beep).toHaveBeenCalledTimes(1);
    }
    await advance(135_000);
    for (const d of [host, people.Alex!]) await d.q.findByText('+02:15');
    expect(host.sound.beep).toHaveBeenCalledTimes(1);
    // nothing else changes: still the same stop
    expect(host.t.app.state.value!.extensions.flow).toMatchObject({ stop: 'checkIn' });
  });

  it('the banner is shown even when the sound is muted on the device or for everybody, and no beep plays', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, people } = await runningSession({ participants: ['Alex', 'Blake'] });
    people.Alex!.t.app.setLocalMuted(true);
    host.t.app.flowIntent('flow.timer', { action: 'start' });
    await waitFor(() => {
      for (const d of [host, ...Object.values(people)]) expect(d.q.getByText('Running')).toBeTruthy();
    });
    await advance(5 * 60_000 + 500);
    for (const d of [host, people.Alex!, people.Blake!]) await d.q.findByText('Time is over');
    expect(people.Alex!.sound.beep).not.toHaveBeenCalled();
    expect(host.sound.beep).toHaveBeenCalledTimes(1);
    expect(people.Blake!.sound.beep).toHaveBeenCalledTimes(1);

    host.t.app.flowIntent('flow.timer', { action: 'reset' });
    host.t.app.flowIntent('flow.muteAll', { muted: true });
    host.t.app.flowIntent('flow.timer', { action: 'start' });
    await waitFor(() => {
      for (const d of [host, ...Object.values(people)]) expect(d.q.getByText('Running')).toBeTruthy();
    });
    await advance(5 * 60_000 + 500);
    for (const d of [host, people.Alex!, people.Blake!]) await d.q.findByText('Time is over');
    expect(host.sound.beep).toHaveBeenCalledTimes(1);
    expect(people.Blake!.sound.beep).toHaveBeenCalledTimes(1);
    expect(people.Alex!.sound.beep).not.toHaveBeenCalled();
  });

  it('shows "Not synchronized" and keeps counting when the Facilitator is offline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { host, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.timer', { action: 'start' });
    await waitFor(() => expect(people.Alex!.q.getByText('Running')).toBeTruthy());
    host.t.app.closeConnections();
    await advance(60_000); // the client retries, then gives up and shows Facilitator offline
    await people.Alex!.q.findByText('Not synchronized');
    const before = timerText(people.Alex!);
    await advance(20_000);
    await waitFor(() => expect(timerText(people.Alex!)).not.toBe(before));
  });
});
