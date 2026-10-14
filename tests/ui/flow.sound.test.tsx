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

describe('sound controls (AC-22)', () => {
  it('the device toggle mutes only this device and is remembered in retro.prefs', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    const alex = people.Alex!;
    fireEvent.click(alex.q.getByRole('button', { name: 'Mute sound on this device' }));
    expect(alex.q.getByRole('button', { name: 'Unmute sound on this device' })).toBeTruthy();
    expect(host.q.getByRole('button', { name: 'Mute sound on this device' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('retro.prefs')!)).toMatchObject({ muted: true });
    fireEvent.click(alex.q.getByRole('button', { name: 'Unmute sound on this device' }));
    expect(alex.q.getByRole('button', { name: 'Mute sound on this device' })).toBeTruthy();
  });

  it('"Mute sound for everybody" is for the Facilitator only and tells participants', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    const alex = people.Alex!;
    expect(alex.q.queryByRole('button', { name: 'Mute sound for everybody' })).toBeNull();
    expect(alex.q.queryByText('Sound is muted by the Facilitator')).toBeNull();
    fireEvent.click(host.q.getByRole('button', { name: 'Mute sound for everybody' }));
    await alex.q.findByText('Sound is muted by the Facilitator');
    expect(host.q.getByRole('button', { name: 'Unmute sound for everybody' })).toBeTruthy();
    fireEvent.click(host.q.getByRole('button', { name: 'Unmute sound for everybody' }));
    await vi.waitFor(() => expect(alex.q.queryByText('Sound is muted by the Facilitator')).toBeNull());
  });
});
