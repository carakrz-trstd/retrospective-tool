import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';
import { resetRegistries } from '../../src/core/registry';
import { getPhaseTexts } from '../../src/flow/data/schema';
import { resetFlowRegistries } from '../../src/flow/registries';
import { getFormat } from '../../src/formats/library';
import { runningSession } from './flowHelpers';

afterEach(() => {
  cleanup();
  resetRegistries();
  resetFlowRegistries();
  localStorage.clear();
  vi.useRealTimers();
});

const texts = getPhaseTexts();

describe('phase panel (AC-6, AC-12, AC-15)', () => {
  it('the Facilitator sees the full instruction; a participant sees only the title and the one-line text', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    const checkIn = texts.phases[0]!;
    expect(host.q.getByText(checkIn.instruction)).toBeTruthy();
    expect(host.q.getByText(checkIn.oneLine)).toBeTruthy();
    const alex = people.Alex!;
    expect(alex.q.getByRole('heading', { name: 'Check-in' })).toBeTruthy();
    expect(alex.q.getByText(checkIn.oneLine)).toBeTruthy();
    expect(alex.q.queryByText(checkIn.instruction)).toBeNull();
  });

  it("in retro stops the Facilitator sees the step instruction and the format's tips; participants do not", async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.goto', { stop: 'retro.write' });
    const step = texts.retroSteps[0]!;
    await host.q.findByText(step.instruction);
    const tip = getFormat('start-stop-continue')!.facilitationTips[0]!;
    expect(host.q.getByText(tip)).toBeTruthy();
    const alex = people.Alex!;
    await alex.q.findByText(step.oneLine);
    expect(alex.q.queryByText(step.instruction)).toBeNull();
    expect(alex.q.queryByText(tip)).toBeNull();
  });

  it('the review stop shows the reminder text and no inputs', async () => {
    const { host, people } = await runningSession({ participants: ['Alex'] });
    host.t.app.flowIntent('flow.goto', { stop: 'reviewActions' });
    for (const d of [host, people.Alex!]) {
      await d.q.findByText(texts.phases[1]!.oneLine);
      expect(d.q.getByText(/Confluence or Miro/)).toBeTruthy();
      expect(d.container.querySelectorAll('main input, main textarea').length).toBe(0);
    }
  });

  it('the placeholder content area is shown when no contributions module is registered', async () => {
    const { host } = await runningSession();
    expect(host.q.getByText(/Content for this phase is added by the contributions module/)).toBeTruthy();
  });
});
