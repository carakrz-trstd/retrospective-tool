import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabGuard } from '../src/tabs/TabGuard';
import { FakeChannels, FakeLocks } from './tabFakes';

afterEach(() => vi.useRealTimers());

function twoTabs() {
  const locks = new FakeLocks();
  const channels = new FakeChannels();
  const make = () => new TabGuard({ locks, createChannel: channels.create, takeOverTimeoutMs: 1000 });
  return { locks, tab1: make(), tab2: make() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('TabGuard', () => {
  it('the first tab acquires the host role and the second is told it is taken', async () => {
    const { tab1, tab2 } = twoTabs();
    expect(await tab1.acquireHost('S1')).toBe('acquired');
    expect(await tab2.acquireHost('S1')).toBe('taken');
  });

  it('different sessions do not block each other', async () => {
    const { tab1, tab2 } = twoTabs();
    expect(await tab1.acquireHost('S1')).toBe('acquired');
    expect(await tab2.acquireHost('S2')).toBe('acquired');
  });

  it('a take-over makes the first tab stop hosting and release, and the second tab acquires', async () => {
    const { locks, tab1, tab2 } = twoTabs();
    await tab1.acquireHost('S1');
    const takenOver = vi.fn();
    tab1.onTakenOver(takenOver);
    expect(await tab2.acquireHost('S1')).toBe('taken');
    const result = await tab2.requestTakeOver('S1');
    expect(result).toBe('acquired');
    expect(takenOver).toHaveBeenCalledWith('S1');
    expect(locks.isHeld('retro-host-S1')).toBe(true); // now held by tab 2
    // the first tab cannot get it back by itself
    expect(await tab1.acquireHost('S1')).toBe('taken');
  });

  it('a crashed first tab (lock released by the browser) lets the next call acquire immediately', async () => {
    const { locks, tab1, tab2 } = twoTabs();
    await tab1.acquireHost('S1');
    locks.crash('retro-host-S1');
    await flush();
    expect(await tab2.acquireHost('S1')).toBe('acquired');
  });

  it('a reload of the only tab re-acquires cleanly', async () => {
    const locks = new FakeLocks();
    const channels = new FakeChannels();
    const before = new TabGuard({ locks, createChannel: channels.create });
    await before.acquireHost('S1');
    // the page unloads: the browser releases the lock; the new page has a new guard
    locks.crash('retro-host-S1');
    await flush();
    const after = new TabGuard({ locks, createChannel: channels.create });
    expect(await after.acquireHost('S1')).toBe('acquired');
  });

  it('release lets another tab acquire', async () => {
    const { tab1, tab2 } = twoTabs();
    await tab1.acquireHost('S1');
    tab1.release('S1');
    await flush();
    expect(await tab2.acquireHost('S1')).toBe('acquired');
  });

  it('a take-over times out when the other tab never lets go, without hosting', async () => {
    vi.useFakeTimers();
    const locks = new FakeLocks();
    const channels = new FakeChannels();
    const tab1 = new TabGuard({ locks, createChannel: channels.create });
    const tab2 = new TabGuard({ locks, createChannel: channels.create, takeOverTimeoutMs: 1000 });
    await tab1.acquireHost('S1');
    // tab 1 ignores the request: simulate by removing its listener
    (tab1 as unknown as { channels: Map<string, { onmessage: unknown }> }).channels.get('S1')!.onmessage =
      null;
    const pending = tab2.requestTakeOver('S1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe('timeout');
  });

  it('without the Web Locks feature the guard does not block', async () => {
    const guard = new TabGuard({ locks: null });
    expect(await guard.acquireHost('S1')).toBe('acquired');
  });
});
