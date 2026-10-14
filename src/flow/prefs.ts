// Device preferences (own sound mute), kept in localStorage under retro.prefs.
type PrefsStorage = Pick<Storage, 'getItem' | 'setItem'>;

const KEY = 'retro.prefs';

function defaultStorage(): PrefsStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function read(storage: PrefsStorage | undefined): Record<string, unknown> {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getLocalMuted(storage: PrefsStorage | undefined = defaultStorage()): boolean {
  return read(storage).muted === true;
}

export function setLocalMuted(muted: boolean, storage: PrefsStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...read(storage), muted }));
  } catch {
    // the preference just does not persist
  }
}
