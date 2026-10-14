import { afterEach, describe, expect, it } from 'vitest';
import { suggestedMs } from '../../src/flow/suggested';
import { testFormat } from '../helpers';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup, T0 } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

describe('flow intents: timer', () => {
  it("start uses the stop's suggested duration and the host's time for startedAt", async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'retro.discuss' });
    s.clock.now = T0 + 5_000;
    s.intent('flow.timer', { action: 'start' });
    const t = s.flow().timers['retro.discuss']!;
    expect(t.status).toBe('running');
    expect(t.startedAt).toBe(T0 + 5_000);
    expect(t.remainingMs).toBe(suggestedMs('retro.discuss', testFormat, 50));
  });

  it('start, pause and reset act only on the timer of the current stop', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.timer', { action: 'start' });
    s.intent('flow.next');
    s.intent('flow.timer', { action: 'start' });
    s.clock.now = T0 + 30_000;
    s.intent('flow.timer', { action: 'pause' });
    expect(s.flow().timers.reviewActions!.status).toBe('paused');
    expect(s.flow().timers.checkIn!.status).toBe('paused'); // paused when it was left
    s.intent('flow.timer', { action: 'reset' });
    expect(s.flow().timers.reviewActions!.status).toBe('idle');
    expect(s.flow().timers.checkIn!.status).toBe('paused'); // untouched by the reset
  });

  it('start on a running timer and pause on a non-running timer change nothing', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.timer', { action: 'start' });
    const t = structuredClone(s.flow().timers.checkIn);
    s.clock.now = T0 + 10_000;
    s.intent('flow.timer', { action: 'start' });
    expect(s.flow().timers.checkIn).toEqual(t);
    s.intent('flow.next');
    s.intent('flow.timer', { action: 'pause' });
    expect(s.flow().timers.reviewActions?.status ?? 'idle').toBe('idle');
  });
});
