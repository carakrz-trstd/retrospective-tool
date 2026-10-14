// Versioned local persistence in the browser (localStorage), plus a per-tab pointer in
// sessionStorage. Every access is wrapped in try/catch because storage can be missing or
// throw (private mode, blocked site data): the app then keeps working without resume.
//
// Keys:
//   retro.host.<sessionId>         Facilitator's session (HostData)
//   retro.participant.<sessionId>  participant's identity, last state and outbox
//   retro.final.<sessionId>        final documentation (written by Epic 5; removed here too)
//   retro.identity                 remembered name and role (pre-fill)
//   retro.index                    list of sessions for resume/rejoin offers and the expiry sweep
//   sessionStorage retro.activeSession   the session this browser tab is in

import { config } from '../config';
import type { Intent } from '../core/protocol';
import type { HostData, SessionState } from '../core/types';

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_SCHEMA_VERSION = 1;

export interface ParticipantRecord {
  token: string;
  participantId: string;
  name: string;
  role: string;
  lastState: SessionState | null;
  lastSeq: number;
  /** Intents not yet acknowledged by the host. */
  outbox: Intent[];
  /** The participant used "Leave session": do not reconnect by themselves. */
  leftLocally: boolean;
}

export interface Identity {
  name: string;
  role: string;
}

export interface IndexEntry {
  sessionId: string;
  role: 'host' | 'participant';
  savedAt: number;
}

interface Envelope<T> {
  schemaVersion: number;
  savedAt: number;
  data: T;
}

const HOST_PREFIX = 'retro.host.';
const PARTICIPANT_PREFIX = 'retro.participant.';
const FINAL_PREFIX = 'retro.final.';
const IDENTITY_KEY = 'retro.identity';
const INDEX_KEY = 'retro.index';
const ACTIVE_KEY = 'retro.activeSession';

export interface StoreOptions {
  local?: StorageLike | null;
  session?: StorageLike | null;
  now?: () => number;
  expiryMs?: number;
}

export class Store {
  private readonly local: StorageLike | null;
  private readonly session: StorageLike | null;
  private readonly now: () => number;
  private readonly expiryMs: number;

  constructor(options: StoreOptions = {}) {
    this.local = options.local === undefined ? safeStorage('localStorage') : options.local;
    this.session = options.session === undefined ? safeStorage('sessionStorage') : options.session;
    this.now = options.now ?? (() => Date.now());
    this.expiryMs = options.expiryMs ?? config.expiryMs;
  }

  /** True when localStorage can be written and read back. */
  isAvailable(): boolean {
    if (!this.local) return false;
    try {
      const probe = 'retro.probe';
      this.local.setItem(probe, '1');
      const ok = this.local.getItem(probe) === '1';
      this.local.removeItem(probe);
      return ok;
    } catch {
      return false;
    }
  }

  // ---- host record ----------------------------------------------------------------------

  saveHostRecord(data: HostData): void {
    this.writeEnvelope(HOST_PREFIX + data.state.sessionId, data);
    this.touchIndex(data.state.sessionId, 'host');
  }

  loadHostRecord(sessionId: string): HostData | null {
    return this.readEnvelope<HostData>(HOST_PREFIX + sessionId);
  }

  // ---- participant record ---------------------------------------------------------------

  saveParticipantRecord(sessionId: string, record: ParticipantRecord): void {
    this.writeEnvelope(PARTICIPANT_PREFIX + sessionId, record);
    this.touchIndex(sessionId, 'participant');
  }

  loadParticipantRecord(sessionId: string): ParticipantRecord | null {
    return this.readEnvelope<ParticipantRecord>(PARTICIPANT_PREFIX + sessionId);
  }

  /** Removes only this device's participant record of a session (not a host record). */
  removeParticipantRecord(sessionId: string): void {
    this.removeRaw(PARTICIPANT_PREFIX + sessionId);
    this.writeIndex(this.readIndex().filter((e) => !(e.sessionId === sessionId && e.role === 'participant')));
    if (this.getActiveSession() === sessionId) this.setActiveSession(null);
  }

  // ---- identity (pre-fill) ----------------------------------------------------------------

  saveIdentity(identity: Identity): void {
    this.writeRaw(IDENTITY_KEY, JSON.stringify(identity));
  }

  loadIdentity(): Identity | null {
    const raw = this.readRaw(IDENTITY_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      if (typeof parsed.name === 'string' && typeof parsed.role === 'string') {
        return { name: parsed.name, role: parsed.role };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  forgetIdentity(): void {
    this.removeRaw(IDENTITY_KEY);
  }

  // ---- index, removal, expiry -------------------------------------------------------------

  listIndex(): IndexEntry[] {
    return this.readIndex();
  }

  /** Removes everything this device keeps for a session. */
  removeSession(sessionId: string): void {
    this.removeRaw(HOST_PREFIX + sessionId);
    this.removeRaw(PARTICIPANT_PREFIX + sessionId);
    this.removeRaw(FINAL_PREFIX + sessionId);
    this.writeIndex(this.readIndex().filter((e) => e.sessionId !== sessionId));
    if (this.getActiveSession() === sessionId) this.setActiveSession(null);
  }

  /** Removes records not written for the expiry time. Returns the session IDs that were removed. */
  sweepExpired(): string[] {
    const removed = new Set<string>();
    const cutoff = this.now() - this.expiryMs;
    for (const key of this.allKeys()) {
      const prefix = [HOST_PREFIX, PARTICIPANT_PREFIX, FINAL_PREFIX].find((p) => key.startsWith(p));
      if (!prefix) continue;
      const raw = this.readRaw(key);
      if (!raw) continue;
      let savedAt: number | undefined;
      try {
        savedAt = (JSON.parse(raw) as { savedAt?: number }).savedAt;
      } catch {
        continue; // unreadable records are handled by listUnreadable/deleteUnreadable
      }
      if (typeof savedAt === 'number' && savedAt < cutoff) {
        removed.add(key.slice(prefix.length));
      }
    }
    for (const id of removed) this.removeSession(id);
    return Array.from(removed);
  }

  /** Keys of records that cannot be read (unknown schemaVersion or broken JSON). */
  listUnreadable(): string[] {
    const bad: string[] = [];
    for (const key of this.allKeys()) {
      if (![HOST_PREFIX, PARTICIPANT_PREFIX].some((p) => key.startsWith(p))) continue;
      if (this.readEnvelope(key) === null) bad.push(key);
    }
    return bad;
  }

  deleteUnreadable(): void {
    for (const key of this.listUnreadable()) {
      this.removeRaw(key);
      const sessionId = key.replace(HOST_PREFIX, '').replace(PARTICIPANT_PREFIX, '');
      this.writeIndex(this.readIndex().filter((e) => e.sessionId !== sessionId));
    }
  }

  // ---- per-tab pointer ----------------------------------------------------------------------

  setActiveSession(sessionId: string | null): void {
    if (!this.session) return;
    try {
      if (sessionId === null) this.session.removeItem(ACTIVE_KEY);
      else this.session.setItem(ACTIVE_KEY, sessionId);
    } catch {
      /* ignore */
    }
  }

  getActiveSession(): string | null {
    if (!this.session) return null;
    try {
      return this.session.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  }

  // ---- internals ----------------------------------------------------------------------------

  private writeEnvelope<T>(key: string, data: T): void {
    const envelope: Envelope<T> = { schemaVersion: STORAGE_SCHEMA_VERSION, savedAt: this.now(), data };
    this.writeRaw(key, JSON.stringify(envelope));
  }

  private readEnvelope<T>(key: string): T | null {
    const raw = this.readRaw(key);
    if (raw === null) return null;
    try {
      const envelope = JSON.parse(raw) as Partial<Envelope<T>>;
      if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION || envelope.data === undefined) return null;
      return envelope.data;
    } catch {
      return null;
    }
  }

  private readIndex(): IndexEntry[] {
    const raw = this.readRaw(INDEX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { schemaVersion?: number; entries?: IndexEntry[] };
      if (parsed.schemaVersion !== STORAGE_SCHEMA_VERSION || !Array.isArray(parsed.entries)) return [];
      return parsed.entries;
    } catch {
      return [];
    }
  }

  private writeIndex(entries: IndexEntry[]): void {
    this.writeRaw(INDEX_KEY, JSON.stringify({ schemaVersion: STORAGE_SCHEMA_VERSION, entries }));
  }

  private touchIndex(sessionId: string, role: 'host' | 'participant'): void {
    const entries = this.readIndex().filter((e) => !(e.sessionId === sessionId && e.role === role));
    entries.push({ sessionId, role, savedAt: this.now() });
    this.writeIndex(entries);
  }

  private allKeys(): string[] {
    if (!this.local) return [];
    try {
      const keys: string[] = [];
      for (let i = 0; i < this.local.length; i++) {
        const key = this.local.key(i);
        if (key) keys.push(key);
      }
      return keys;
    } catch {
      return [];
    }
  }

  private readRaw(key: string): string | null {
    if (!this.local) return null;
    try {
      return this.local.getItem(key);
    } catch {
      return null;
    }
  }

  private writeRaw(key: string, value: string): void {
    if (!this.local) return;
    try {
      this.local.setItem(key, value);
    } catch {
      /* storage full or blocked: the app keeps working without resume */
    }
  }

  private removeRaw(key: string): void {
    if (!this.local) return;
    try {
      this.local.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function safeStorage(name: 'localStorage' | 'sessionStorage'): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window[name] : null;
  } catch {
    return null;
  }
}

/** The store used by the app. */
export const store = new Store();
