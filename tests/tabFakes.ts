import type { ChannelLike, LockManagerLike } from '../src/tabs/TabGuard';

/** A fake of the browser's lock manager that follows the same rules (one holder, a waiting queue). */
export class FakeLocks implements LockManagerLike {
  private holders = new Map<string, () => void>();
  private queues = new Map<string, (() => void)[]>();

  request(
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: unknown | null) => Promise<void> | void,
  ): Promise<unknown> {
    return new Promise((resolve) => {
      const grant = () => {
        let release!: () => void;
        const released = new Promise<void>((r) => (release = r));
        this.holders.set(name, release);
        Promise.resolve(callback({ name })).then(() => release());
        void released.then(() => {
          this.holders.delete(name);
          const next = this.queues.get(name)?.shift();
          if (next) next();
          resolve(undefined);
        });
      };
      if (!this.holders.has(name)) grant();
      else if (options.ifAvailable) {
        Promise.resolve(callback(null)).then(() => resolve(undefined));
      } else {
        const q = this.queues.get(name) ?? [];
        q.push(grant);
        this.queues.set(name, q);
      }
    });
  }

  /** Simulates a crashed tab: whoever holds the lock loses it. */
  crash(name: string): void {
    this.holders.get(name)?.();
  }

  isHeld(name: string): boolean {
    return this.holders.has(name);
  }
}

/** A fake BroadcastChannel bus: messages reach all channels of the same name except the sender. */
export class FakeChannels {
  private channels = new Map<string, Set<FakeChannel>>();

  create = (name: string): ChannelLike => {
    const c = new FakeChannel(name, this);
    const set = this.channels.get(name) ?? new Set();
    set.add(c);
    this.channels.set(name, set);
    return c;
  };

  deliver(from: FakeChannel, name: string, data: unknown): void {
    for (const c of this.channels.get(name) ?? []) {
      if (c !== from && !c.closed) queueMicrotask(() => c.onmessage?.({ data }));
    }
  }
}

class FakeChannel implements ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(
    private name: string,
    private bus: FakeChannels,
  ) {}
  postMessage(message: unknown): void {
    this.bus.deliver(this, this.name, message);
  }
  close(): void {
    this.closed = true;
  }
}
