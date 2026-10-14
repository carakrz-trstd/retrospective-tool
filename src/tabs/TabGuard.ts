// Only one tab may host a session at a time (FR-1.13). The browser's Web Locks feature gives
// exact, crash-safe ownership: the lock is released when the tab dies, so there are no stale
// markers. A BroadcastChannel carries the "take over" request to the tab that holds the lock.

export interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: unknown | null) => Promise<void> | void,
  ): Promise<unknown>;
}

export interface ChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export interface TabGuardOptions {
  locks?: LockManagerLike | null;
  createChannel?: (name: string) => ChannelLike;
  /** How long a take-over waits for the other tab to let go. */
  takeOverTimeoutMs?: number;
}

export type AcquireResult = 'acquired' | 'taken';

const lockName = (sessionId: string) => `retro-host-${sessionId}`;
const channelName = (sessionId: string) => `retro-host-${sessionId}`;

export class TabGuard {
  private readonly locks: LockManagerLike | null;
  private readonly createChannel: (name: string) => ChannelLike;
  private readonly takeOverTimeoutMs: number;
  private releasers = new Map<string, () => void>();
  private channels = new Map<string, ChannelLike>();
  private takenOverCbs = new Set<(sessionId: string) => void>();

  constructor(options: TabGuardOptions = {}) {
    this.locks = options.locks === undefined ? defaultLocks() : options.locks;
    this.createChannel =
      options.createChannel ?? ((name) => new BroadcastChannel(name) as unknown as ChannelLike);
    this.takeOverTimeoutMs = options.takeOverTimeoutMs ?? 5_000;
  }

  /** Tries to become the host tab of a session; the lock is held for the life of the tab. */
  acquireHost(sessionId: string): Promise<AcquireResult> {
    if (!this.locks) return Promise.resolve('acquired'); // no Web Locks: cannot guard, do not block
    return new Promise<AcquireResult>((resolve) => {
      void this.locks!.request(lockName(sessionId), { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve('taken');
          return;
        }
        resolve('acquired');
        this.listenForTakeOver(sessionId);
        return new Promise<void>((release) => this.releasers.set(sessionId, release));
      });
    });
  }

  /** Asks the host tab to step aside, then waits for the lock. */
  requestTakeOver(sessionId: string): Promise<'acquired' | 'timeout'> {
    if (!this.locks) return Promise.resolve('acquired');
    return new Promise((resolve) => {
      let done = false;
      const channel = this.channel(sessionId);
      const finish = (result: 'acquired' | 'timeout') => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(() => finish('timeout'), this.takeOverTimeoutMs);
      // queue for the lock: it is granted as soon as the first tab releases it (or dies)
      void this.locks!.request(lockName(sessionId), {}, (lock) => {
        if (!lock || done) return;
        finish('acquired');
        this.listenForTakeOver(sessionId);
        return new Promise<void>((release) => this.releasers.set(sessionId, release));
      });
      channel.postMessage({ type: 'takeover-request' });
    });
  }

  /** Called in the first tab when another tab takes over: stop hosting and go read-only. */
  onTakenOver(cb: (sessionId: string) => void): () => void {
    this.takenOverCbs.add(cb);
    return () => this.takenOverCbs.delete(cb);
  }

  /** Lets go of the host role (also used on reload before re-acquiring). */
  release(sessionId: string): void {
    this.releasers.get(sessionId)?.();
    this.releasers.delete(sessionId);
    const channel = this.channels.get(sessionId);
    if (channel) {
      channel.onmessage = null;
      channel.close();
      this.channels.delete(sessionId);
    }
  }

  private channel(sessionId: string): ChannelLike {
    let channel = this.channels.get(sessionId);
    if (!channel) {
      channel = this.createChannel(channelName(sessionId));
      this.channels.set(sessionId, channel);
    }
    return channel;
  }

  private listenForTakeOver(sessionId: string): void {
    const channel = this.channel(sessionId);
    channel.onmessage = (event) => {
      const data = event.data as { type?: string } | null;
      if (data?.type !== 'takeover-request') return;
      if (!this.releasers.has(sessionId)) return;
      for (const cb of this.takenOverCbs) cb(sessionId);
      this.release(sessionId);
    };
  }
}

function defaultLocks(): LockManagerLike | null {
  try {
    return typeof navigator !== 'undefined' && navigator.locks
      ? (navigator.locks as unknown as LockManagerLike)
      : null;
  } catch {
    return null;
  }
}
