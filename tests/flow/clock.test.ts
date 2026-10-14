import { describe, expect, it } from 'vitest';
import { HostClock } from '../../src/flow/clock';
import { remaining, start, IDLE } from '../../src/flow/timer';

describe('HostClock', () => {
  it('with no observations hostNow() falls back to the local time', () => {
    const clock = new HostClock({ localNow: () => 5_000 });
    expect(clock.hostNow()).toBe(5_000);
  });

  it('on the host hostNow() equals the local time, whatever was observed', () => {
    const clock = new HostClock({ localNow: () => 5_000, isHost: true });
    clock.observe(1_000, 9_000);
    expect(clock.hostNow()).toBe(5_000);
  });

  it('uses the observation with the smallest delay (40, 300, 120 ms -> 40 ms)', () => {
    let local = 1_040;
    const clock = new HostClock({ localNow: () => local });
    clock.observe(1_000, 1_040); // delay 40
    clock.observe(2_000, 2_300); // delay 300
    clock.observe(3_000, 3_120); // delay 120
    local = 5_000;
    expect(clock.hostNow()).toBe(4_960);
  });

  it('a delayed message does not move the estimate later', () => {
    let local = 0;
    const clock = new HostClock({ localNow: () => local });
    clock.observe(1_000, 1_040);
    local = 5_000;
    const before = clock.hostNow();
    clock.observe(4_000, 4_900); // a slow message
    expect(clock.hostNow()).toBe(before);
  });

  it('keeps only the last 30 observations', () => {
    let local = 0;
    const clock = new HostClock({ localNow: () => local });
    clock.observe(0, 10); // delay 10, will fall out of the window
    for (let i = 1; i <= 30; i++) clock.observe(i * 1000, i * 1000 + 100);
    local = 100_000;
    expect(clock.hostNow()).toBe(99_900);
  });

  it('a device whose clock is 5 minutes ahead still shows the correct remaining time within 1 second', () => {
    const SKEW = 5 * 60_000;
    const duration = 5 * 60_000;
    let hostTrue = 1_000_000; // the host's real time
    const local = () => hostTrue + SKEW; // this device's clock
    const clock = new HostClock({ localNow: local });
    // the host starts the timer at hostTrue; a message arrives 80 ms later
    const startedAt = hostTrue;
    hostTrue += 80;
    clock.observe(startedAt, local());
    hostTrue += 60_000; // one minute later
    const rem = remaining(start(IDLE, duration, startedAt), duration, clock.hostNow());
    expect(Math.abs(rem - (duration - 60_000))).toBeLessThanOrEqual(1_000);
  });
});
