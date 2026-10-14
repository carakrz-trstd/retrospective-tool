// The end-of-time beep (Web Audio) and the mute rule. Any failure is swallowed: the visual
// alert never depends on the sound.

interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
}
interface AudioContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  createOscillator(): {
    type: string;
    frequency: AudioParamLike;
    connect(n: unknown): unknown;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): { gain: AudioParamLike; connect(n: unknown): unknown };
  resume(): Promise<void>;
}

export interface SoundPlayerOptions {
  createContext?: () => AudioContextLike | undefined;
  doc?: Pick<Document, 'addEventListener' | 'visibilityState'>;
}

const FREQUENCY_HZ = 880;
const DURATION_S = 0.25;

function defaultCreateContext(): AudioContextLike | undefined {
  const w = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : undefined;
}

export class SoundPlayer {
  private ctx: AudioContextLike | undefined;
  private readonly createContext: () => AudioContextLike | undefined;
  private readonly doc: SoundPlayerOptions['doc'];

  constructor(opts: SoundPlayerOptions = {}) {
    this.createContext = opts.createContext ?? defaultCreateContext;
    this.doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined);
    this.doc?.addEventListener('visibilitychange', () => {
      if (this.doc?.visibilityState === 'visible') this.resume();
    });
  }

  /** Creates the audio context (once). Call it from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch {
        this.ctx = undefined;
      }
    }
    this.resume();
  }

  /** Plays the beep; returns whether it was played. */
  beep(): boolean {
    if (!this.ctx) this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return false;
    try {
      this.resume();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = FREQUENCY_HZ;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + DURATION_S);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + DURATION_S);
      return true;
    } catch {
      return false;
    }
  }

  private resume(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'suspended') return;
    try {
      Promise.resolve(ctx.resume()).catch(() => {});
    } catch {
      // ignored on purpose
    }
  }
}

/** Unlocks the sound on the first tap or key press, then removes itself. */
export function installUnlockOnFirstGesture(
  player: Pick<SoundPlayer, 'unlock'>,
  target: EventTarget = window,
): void {
  const handler = () => {
    target.removeEventListener('pointerdown', handler);
    target.removeEventListener('keydown', handler);
    player.unlock();
  };
  target.addEventListener('pointerdown', handler);
  target.addEventListener('keydown', handler);
}

/** The sound plays only when neither the Facilitator nor this device muted it. */
export function shouldPlay(flow: { soundMutedForAll: boolean }, localMuted: boolean): boolean {
  return !flow.soundMutedForAll && !localMuted;
}
