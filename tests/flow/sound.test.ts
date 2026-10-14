import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundPlayer, installUnlockOnFirstGesture } from '../../src/flow/sound';

class FakeParam {
  value = 0;
  calls: unknown[][] = [];
  setValueAtTime(...a: unknown[]) {
    this.calls.push(['set', ...a]);
  }
  linearRampToValueAtTime(...a: unknown[]) {
    this.calls.push(['ramp', ...a]);
  }
  exponentialRampToValueAtTime(...a: unknown[]) {
    this.calls.push(['expramp', ...a]);
  }
}
class FakeOscillator {
  type = '';
  frequency = new FakeParam();
  started: number[] = [];
  stopped: number[] = [];
  connect() {}
  start(t: number) {
    this.started.push(t);
  }
  stop(t: number) {
    this.stopped.push(t);
  }
}

let created: FakeContext[];
class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime = 10;
  destination = {};
  oscillators: FakeOscillator[] = [];
  resumed = 0;
  constructor() {
    created.push(this);
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return { gain: new FakeParam(), connect() {} };
  }
  resume() {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
}

function fakeDoc() {
  const target = new EventTarget();
  return Object.assign(target, { visibilityState: 'visible' as DocumentVisibilityState });
}

beforeEach(() => {
  created = [];
});

describe('SoundPlayer', () => {
  it('unlock() creates one context and later calls reuse it', () => {
    const p = new SoundPlayer({ createContext: () => new FakeContext() as never, doc: fakeDoc() });
    p.unlock();
    p.unlock();
    p.beep();
    expect(created).toHaveLength(1);
  });

  it('beep() plays one 880 Hz sine oscillator for 0.25 s and returns true', () => {
    const p = new SoundPlayer({ createContext: () => new FakeContext() as never, doc: fakeDoc() });
    p.unlock();
    expect(p.beep()).toBe(true);
    const osc = created[0]!.oscillators;
    expect(osc).toHaveLength(1);
    expect(osc[0]!.type).toBe('sine');
    expect(osc[0]!.frequency.value).toBe(880);
    expect(osc[0]!.started).toEqual([10]);
    expect(osc[0]!.stopped).toEqual([10.25]);
  });

  it('a suspended context is resumed before the beep and when the page becomes visible', () => {
    const doc = fakeDoc();
    const p = new SoundPlayer({ createContext: () => new FakeContext() as never, doc });
    p.unlock();
    created[0]!.state = 'suspended';
    expect(p.beep()).toBe(true);
    expect(created[0]!.resumed).toBe(1);
    created[0]!.state = 'suspended';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(created[0]!.resumed).toBe(2);
  });

  it('without Web Audio beep() returns false and does not throw', () => {
    const p = new SoundPlayer({ createContext: () => undefined, doc: fakeDoc() });
    expect(() => p.unlock()).not.toThrow();
    expect(p.beep()).toBe(false);
  });

  it('when the context cannot start beep() returns false and does not throw', () => {
    const throwing = new SoundPlayer({
      createContext: () => {
        throw new Error('blocked');
      },
      doc: fakeDoc(),
    });
    expect(throwing.beep()).toBe(false);

    const brokenOsc = new SoundPlayer({
      createContext: () => {
        const c = new FakeContext();
        c.createOscillator = () => {
          throw new Error('nope');
        };
        return c as never;
      },
      doc: fakeDoc(),
    });
    expect(brokenOsc.beep()).toBe(false);

    const rejecting = new SoundPlayer({
      createContext: () => {
        const c = new FakeContext();
        c.state = 'suspended';
        c.resume = () => Promise.reject(new Error('denied'));
        return c as never;
      },
      doc: fakeDoc(),
    });
    expect(() => rejecting.beep()).not.toThrow();
  });

  it('the one-time pointerdown/keydown listener calls unlock() once and removes itself', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    installUnlockOnFirstGesture({ unlock } as never, target);
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('keydown'));
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});
