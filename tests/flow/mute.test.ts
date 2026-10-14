import { describe, expect, it } from 'vitest';
import { getLocalMuted, setLocalMuted } from '../../src/flow/prefs';
import { shouldPlay } from '../../src/flow/sound';

class MemStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
const throwing = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('mute (AC-22)', () => {
  it('shouldPlay is true only when neither the device nor the Facilitator muted', () => {
    expect(shouldPlay({ soundMutedForAll: false }, false)).toBe(true);
    expect(shouldPlay({ soundMutedForAll: true }, false)).toBe(false);
    expect(shouldPlay({ soundMutedForAll: false }, true)).toBe(false);
    expect(shouldPlay({ soundMutedForAll: true }, true)).toBe(false);
  });

  it('the sound is on by default', () => {
    expect(getLocalMuted(new MemStorage())).toBe(false);
  });

  it('the device preference persists in retro.prefs across reloads', () => {
    const storage = new MemStorage();
    setLocalMuted(true, storage);
    expect(JSON.parse(storage.data.get('retro.prefs')!)).toMatchObject({ muted: true });
    expect(getLocalMuted(storage)).toBe(true);
    setLocalMuted(false, storage);
    expect(getLocalMuted(storage)).toBe(false);
  });

  it('survives a throwing localStorage and garbage content', () => {
    expect(() => setLocalMuted(true, throwing)).not.toThrow();
    expect(getLocalMuted(throwing)).toBe(false);
    const storage = new MemStorage();
    storage.setItem('retro.prefs', '{not json');
    expect(getLocalMuted(storage)).toBe(false);
  });
});
