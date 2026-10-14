// Calls onOver once when the running timer of the current stop reaches zero. A timer that is
// already over when it is first seen (late join, reconnect) stays silent.
import { remaining } from './timer';
import type { FlowState, StopId } from './types';

export interface TimerWatcherOptions {
  hostNow: () => number;
  durationOf: (stop: StopId) => number;
  onOver: (stop: StopId, startedAt: number) => void;
}

export class TimerWatcher {
  private handle: ReturnType<typeof setTimeout> | undefined;
  private watching: string | undefined;
  private done = new Set<string>();

  constructor(private readonly opts: TimerWatcherOptions) {}

  update(flow: FlowState): void {
    const stop = flow.stop;
    const timer = flow.timers[stop];
    if (!timer || timer.status !== 'running' || timer.startedAt === undefined) {
      this.cancel();
      return;
    }
    const key = `${stop}@${timer.startedAt}`;
    if (this.watching === key || this.done.has(key)) return;
    this.cancel();
    const left = remaining(timer, this.opts.durationOf(stop), this.opts.hostNow());
    if (left <= 0) {
      this.done.add(key); // already over: silent
      return;
    }
    this.watching = key;
    this.handle = setTimeout(() => {
      this.handle = undefined;
      this.watching = undefined;
      this.done.add(key);
      this.opts.onOver(stop, timer.startedAt!);
    }, left);
  }

  dispose(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.handle !== undefined) clearTimeout(this.handle);
    this.handle = undefined;
    this.watching = undefined;
  }
}
