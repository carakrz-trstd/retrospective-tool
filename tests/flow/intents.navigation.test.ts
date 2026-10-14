import { afterEach, describe, expect, it } from 'vitest';
import { STOPS } from '../../src/flow/stops';
import { remaining } from '../../src/flow/timer';
import { suggestedMs } from '../../src/flow/suggested';
import { testFormat } from '../helpers';
import type { HostController } from '../../src/host/HostController';
import { cleanup, flowSetup, T0 } from './flowHelpers';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

const MIN = 60_000;

describe('flow intents: navigation (AC-2, AC-5, AC-24)', () => {
  it('flow.next walks through all eight stops in order and stops at checkOut', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    const seen = [s.flow().stop];
    for (let i = 0; i < 9; i++) {
      s.intent('flow.next');
      seen.push(s.flow().stop);
    }
    expect(seen.slice(0, 8)).toEqual([...STOPS]);
    expect(seen.slice(8)).toEqual(['checkOut', 'checkOut']);
  });

  it('flow.prev walks back and stops at checkIn', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    s.intent('flow.goto', { stop: 'notes' });
    const seen: string[] = [];
    for (let i = 0; i < 7; i++) {
      s.intent('flow.prev');
      seen.push(s.flow().stop);
    }
    expect(seen).toEqual([
      'retro.discuss',
      'retro.reveal',
      'retro.write',
      'reviewActions',
      'checkIn',
      'checkIn',
      'checkIn',
    ]);
  });

  it('flow.goto jumps to any stop', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    for (const stop of ['actions', 'checkIn', 'retro.discuss', 'retro.write']) {
      s.intent('flow.goto', { stop });
      expect(s.flow().stop).toBe(stop);
    }
  });

  it('leaving a stop with a running timer pauses it and keeps the remaining time; arriving never starts a timer', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    const duration = suggestedMs('checkIn', testFormat, 50);
    s.intent('flow.timer', { action: 'start' });
    s.clock.now = T0 + 60_000;
    s.intent('flow.next');
    const left = s.flow().timers.checkIn!;
    expect(left.status).toBe('paused');
    expect(left.remainingMs).toBe(duration - 60_000);
    expect(s.flow().timers.reviewActions?.status ?? 'idle').toBe('idle');
    // time passes at the other stop; coming back shows the old remaining time, paused
    s.clock.now = T0 + 10 * MIN;
    s.intent('flow.prev');
    const back = s.flow().timers.checkIn!;
    expect(back.status).toBe('paused');
    expect(remaining(back, duration, s.clock.now)).toBe(duration - 60_000);
  });

  it('flow.timer reset restores the full time (AC-24)', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    const duration = suggestedMs('checkIn', testFormat, 50);
    s.intent('flow.timer', { action: 'start' });
    s.clock.now = T0 + 90_000;
    s.intent('flow.timer', { action: 'pause' });
    s.intent('flow.timer', { action: 'reset' });
    const t = s.flow().timers.checkIn ?? { status: 'idle' as const };
    expect(t.status).toBe('idle');
    expect(remaining(t, duration, s.clock.now)).toBe(duration);
  });
});
