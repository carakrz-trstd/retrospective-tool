// Estimates the host's time on this device. Every host message carries `hostTime`; the smallest
// (receivedAt - hostTime) of the last observations is the best estimate, because network delay
// only ever makes a message look older than it is.

const WINDOW = 30;

export interface HostClockOptions {
  localNow?: () => number;
  /** On the host itself the clock is simply the local time. */
  isHost?: boolean;
}

export class HostClock {
  private offsets: number[] = [];
  private readonly localNow: () => number;
  private readonly isHost: boolean;

  constructor(opts: HostClockOptions = {}) {
    this.localNow = opts.localNow ?? (() => Date.now());
    this.isHost = opts.isHost === true;
  }

  observe(hostTime: number, receivedAt: number): void {
    this.offsets.push(receivedAt - hostTime);
    if (this.offsets.length > WINDOW) this.offsets.shift();
  }

  /** The estimated host time now (the local time while nothing was observed). */
  hostNow(): number {
    if (this.isHost || this.offsets.length === 0) return this.localNow();
    return this.localNow() - Math.min(...this.offsets);
  }
}
