// A participant's side of the connection: join (by link or code), automatic rejoin as the same
// person (token), the outbox for writes made while the Facilitator is offline, connection status
// for the UI, and keeping the last received state.

import { config as defaultConfig } from '../config';
import { applyChanges } from '../core/diff';
import { createOpId, isValidJoinCode, normalizeJoinCode } from '../core/ids';
import { resolverPeerId, sessionPeerId } from '../core/peerIds';
import {
  PROTOCOL_VERSION,
  isHostMessage,
  type ClientMessageBody,
  type HostMessage,
  type Intent,
} from '../core/protocol';
import type { SessionState } from '../core/types';
import { store as defaultStore, type ParticipantRecord, type Store } from '../storage/storage';
import { isNotFound, type Connection, type Transport } from '../transport/Transport';

const DEFAULT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
const LOOKUP_TIMEOUT_MS = 10_000;

export type ClientStatus =
  'connecting' | 'online' | 'reconnecting' | 'facilitator-offline' | 'removed' | 'ended' | 'left' | 'failed';

export type ClientErrorReason =
  'session-not-found' | 'session-ended' | 'name-required' | 'role-required' | 'version' | 'unavailable';

export class ClientFailure extends Error {
  constructor(readonly reason: ClientErrorReason) {
    super(reason);
  }
}

export interface ClientSnapshot {
  status: ClientStatus;
  state: SessionState | null;
  participantId: string | null;
  /** The Facilitator has been offline for the hint time (FR-1.15). */
  longOffline: boolean;
  error: ClientErrorReason | null;
  /** Intents the host has not acknowledged yet. */
  outbox: Intent[];
  /** Intents the host refused, with the reason (the UI can tell the person). */
  rejectedOps: { opId: string; kind: string; reason: string }[];
}

export interface ClientOptions {
  transport: Transport;
  store?: Store;
  hostOfflineHintMs?: number;
  backoffMs?: number[];
  newOpId?: () => string;
  lookupTimeoutMs?: number;
}

type Mode =
  { kind: 'join'; target: string; name: string; role: string } | { kind: 'rejoin'; sessionId: string };

export class ClientController {
  /** Resolves with the first welcome; rejects with a ClientFailure when joining is not possible. */
  ready!: Promise<void>;

  private readonly transport: Transport;
  private readonly store: Store;
  private readonly hintMs: number;
  private readonly backoff: number[];
  private readonly newOpId: () => string;
  private readonly lookupTimeoutMs: number;

  private status: ClientStatus = 'connecting';
  private state: SessionState | null = null;
  private participantId: string | null = null;
  private token: string | null = null;
  private name = '';
  private role = '';
  private sessionId: string | null = null;
  private lastSeq = 0;
  private outbox: Intent[] = [];
  private rejectedOps: ClientSnapshot['rejectedOps'] = [];
  private leftLocally = false;
  private error: ClientErrorReason | null = null;
  private longOffline = false;

  private conn: Connection | null = null;
  private awaitingSnapshot = false;
  private stopped = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private joinedOnce = false;
  private resolveReady!: () => void;
  private rejectReady!: (e: ClientFailure) => void;

  private changeCbs = new Set<(s: ClientSnapshot) => void>();
  private endedCbs = new Set<(payload: unknown) => void>();
  private hostTimeCbs = new Set<(hostTime: number, receivedAt: number) => void>();

  private constructor(
    private readonly mode: Mode,
    opts: ClientOptions,
  ) {
    this.transport = opts.transport;
    this.store = opts.store ?? defaultStore;
    this.hintMs = opts.hostOfflineHintMs ?? defaultConfig.hostOfflineHintMs;
    this.backoff = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
    this.newOpId = opts.newOpId ?? createOpId;
    this.lookupTimeoutMs = opts.lookupTimeoutMs ?? LOOKUP_TIMEOUT_MS;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    // an unhandled rejection must not crash the app when nobody awaits `ready`
    this.ready.catch(() => {});
  }

  /** Joins a session as a new participant; `target` is a join code or a session ID. */
  static join(target: string, input: { name: string; role: string }, opts: ClientOptions): ClientController {
    const c = new ClientController({ kind: 'join', target, name: input.name, role: input.role }, opts);
    c.name = input.name.trim();
    c.role = input.role.trim();
    void c.runJoin();
    return c;
  }

  /** Continues as the same participant from the record this device kept. */
  static rejoin(sessionId: string, opts: ClientOptions): ClientController {
    const c = new ClientController({ kind: 'rejoin', sessionId }, opts);
    const record = c.store.loadParticipantRecord(sessionId);
    if (!record) throw new Error(`No participant record for session ${sessionId}`);
    c.sessionId = sessionId;
    c.token = record.token;
    c.participantId = record.participantId;
    c.name = record.name;
    c.role = record.role;
    c.state = record.lastState;
    c.lastSeq = record.lastSeq;
    c.outbox = record.outbox;
    c.leftLocally = false;
    c.status = 'reconnecting';
    c.persist();
    c.store.setActiveSession(sessionId);
    void c.connectLoop();
    return c;
  }

  // ---- public API -------------------------------------------------------------------------

  get snapshot(): ClientSnapshot {
    return {
      status: this.status,
      state: this.state,
      participantId: this.participantId,
      longOffline: this.longOffline,
      error: this.error,
      outbox: this.outbox,
      rejectedOps: this.rejectedOps,
    };
  }

  onChange(cb: (s: ClientSnapshot) => void): () => void {
    this.changeCbs.add(cb);
    return () => this.changeCbs.delete(cb);
  }

  onEnded(cb: (payload: unknown) => void): () => void {
    this.endedCbs.add(cb);
    return () => this.endedCbs.delete(cb);
  }

  /** Every message from the host carries the host's time; later epics use it to agree on a clock. */
  onHostTime(cb: (hostTime: number, receivedAt: number) => void): () => void {
    this.hostTimeCbs.add(cb);
    return () => this.hostTimeCbs.delete(cb);
  }

  /** Asks the host to make a change. While offline the intent waits in the outbox. */
  sendIntent(kind: string, payload: unknown, opId: string = this.newOpId()): string {
    const intent: Intent = { opId, kind, payload };
    this.outbox = [...this.outbox, intent];
    this.persist();
    this.emit();
    if (this.conn && this.status === 'online') this.sendMessage({ type: 'intent', ...intent });
    return opId;
  }

  /** "Leave session": close on this device only; the record stays so the person can rejoin later. */
  leave(): void {
    if (this.stopped) return;
    if (this.conn && this.status === 'online') this.sendMessage({ type: 'leave' });
    this.leftLocally = true;
    this.persist();
    this.shutdown('left');
  }

  stop(): void {
    this.shutdown(this.status);
  }

  // ---- joining ----------------------------------------------------------------------------

  private fail(reason: ClientErrorReason): void {
    this.error = reason;
    this.rejectReady(new ClientFailure(reason));
    this.shutdown('failed');
  }

  private async runJoin(): Promise<void> {
    if (this.mode.kind !== 'join') return;
    try {
      let sessionId = this.mode.target.trim();
      if (isValidJoinCode(sessionId)) {
        const resolved = await this.lookup(normalizeJoinCode(sessionId));
        if (!resolved) return this.fail('session-not-found');
        sessionId = resolved;
      }
      this.sessionId = sessionId;
      const conn = await this.transport.connect(sessionPeerId(sessionId));
      if (this.stopped) return conn.close();
      this.attach(conn);
      this.sendMessage({ type: 'join', name: this.name, role: this.role });
    } catch (err) {
      if (this.stopped) return;
      this.fail(isNotFound(err) ? 'session-not-found' : 'unavailable');
    }
  }

  /** Asks the short ID derived from the join code for the session ID. */
  private async lookup(code: string): Promise<string | null> {
    let conn: Connection;
    try {
      conn = await this.transport.connect(resolverPeerId(code));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => {
        conn.close();
        resolve(null);
      }, this.lookupTimeoutMs);
      conn.onMessage((raw) => {
        if (!isHostMessage(raw)) return;
        clearTimeout(timer);
        resolve(raw.type === 'resolved' ? raw.sessionId : null); // before close(): the close handler resolves null
        conn.close();
      });
      conn.onClose(() => {
        clearTimeout(timer);
        resolve(null);
      });
      conn.send({ v: PROTOCOL_VERSION, type: 'lookup', code });
    });
  }

  // ---- connection loop --------------------------------------------------------------------

  private setStatus(s: ClientStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.emit();
  }

  private async connectLoop(): Promise<void> {
    if (this.stopped || this.conn || !this.sessionId) return;
    try {
      const conn = await this.transport.connect(sessionPeerId(this.sessionId));
      if (this.stopped) return conn.close();
      this.attach(conn);
      this.sendMessage({ type: 'rejoin', token: this.token! });
    } catch (err) {
      if (this.stopped) return;
      if (isNotFound(err)) this.enterFacilitatorOffline();
      else this.setStatus('reconnecting');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.backoff[Math.min(this.attempt, this.backoff.length - 1)]!;
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectLoop();
    }, delay);
  }

  private enterFacilitatorOffline(): void {
    this.setStatus('facilitator-offline');
    if (!this.hintTimer && !this.longOffline) {
      this.hintTimer = setTimeout(() => {
        this.hintTimer = null;
        this.longOffline = true;
        this.emit();
      }, this.hintMs);
    }
  }

  private clearOffline(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (this.longOffline) {
      this.longOffline = false;
    }
  }

  private attach(conn: Connection): void {
    this.conn = conn;
    this.awaitingSnapshot = false;
    conn.onMessage((raw) => {
      if (this.conn === conn) this.onMessage(raw);
    });
    conn.onClose(() => {
      if (this.conn !== conn) return;
      this.conn = null;
      if (this.stopped || ['removed', 'ended', 'left', 'failed'].includes(this.status)) return;
      this.setStatus('reconnecting');
      this.attempt = 0;
      this.scheduleReconnect();
    });
  }

  private sendMessage(msg: ClientMessageBody): void {
    this.conn?.send({ v: PROTOCOL_VERSION, ...msg });
  }

  // ---- messages in ------------------------------------------------------------------------

  private onMessage(raw: unknown): void {
    if (!isHostMessage(raw)) return;
    const msg: HostMessage = raw;
    if (typeof (msg as { hostTime?: unknown }).hostTime === 'number') {
      const receivedAt = Date.now();
      for (const cb of this.hostTimeCbs) cb((msg as { hostTime: number }).hostTime, receivedAt);
    }
    switch (msg.type) {
      case 'welcome':
        this.onWelcome(msg);
        break;
      case 'update':
        this.onUpdate(msg);
        break;
      case 'ack':
        this.outbox = this.outbox.filter((i) => i.opId !== msg.opId);
        this.persist();
        this.emit();
        break;
      case 'removed':
        this.onRemoved();
        break;
      case 'ended':
        this.handleEnded(msg.payload);
        break;
      case 'rejected':
        this.onRejected(msg);
        break;
      default:
        break;
    }
  }

  private onWelcome(msg: Extract<HostMessage, { type: 'welcome' }>): void {
    this.state = msg.state;
    this.lastSeq = msg.seq;
    this.participantId = msg.participantId;
    if (msg.token) this.token = msg.token;
    this.awaitingSnapshot = false;
    this.attempt = 0;
    this.clearOffline();
    if (this.status !== 'ended') this.setStatus('online');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.joinedOnce) {
      this.joinedOnce = true;
      if (this.sessionId) this.store.setActiveSession(this.sessionId);
      this.store.saveIdentity({ name: this.name, role: this.role });
    }
    this.persist();
    this.emit();
    this.resolveReady();
    // writes made while offline are sent again, in order, with the same operation IDs
    for (const intent of this.outbox) this.sendMessage({ type: 'intent', ...intent });
  }

  private onUpdate(msg: Extract<HostMessage, { type: 'update' }>): void {
    if (!this.state || this.awaitingSnapshot) return;
    if (msg.seq <= this.lastSeq) return; // a duplicate
    if (msg.seq !== this.lastSeq + 1) {
      // a gap: ask for a fresh snapshot and ignore updates until it arrives
      this.awaitingSnapshot = true;
      this.sendMessage({ type: 'resync', haveSeq: this.lastSeq });
      return;
    }
    this.state = { ...applyChanges(this.state, msg.changes), rev: msg.rev };
    this.lastSeq = msg.seq;
    this.persist();
    this.emit();
  }

  private onRemoved(): void {
    if (this.sessionId) this.store.removeParticipantRecord(this.sessionId);
    this.outbox = [];
    this.shutdown('removed');
  }

  private handleEnded(payload: unknown): void {
    this.setStatus('ended');
    this.clearOffline();
    for (const cb of this.endedCbs) cb(payload);
    this.persist();
    this.emit();
    // nothing more to receive: stop trying to reconnect
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private onRejected(msg: Extract<HostMessage, { type: 'rejected' }>): void {
    if (msg.opId) {
      const intent = this.outbox.find((i) => i.opId === msg.opId);
      this.outbox = this.outbox.filter((i) => i.opId !== msg.opId);
      this.rejectedOps = [
        ...this.rejectedOps,
        { opId: msg.opId, kind: intent?.kind ?? '', reason: msg.reason },
      ];
      this.persist();
      this.emit();
      return;
    }
    if (this.mode.kind === 'join' && !this.joinedOnce) {
      const known: ClientErrorReason[] = ['session-ended', 'name-required', 'role-required', 'version'];
      this.fail(
        known.includes(msg.reason as ClientErrorReason)
          ? (msg.reason as ClientErrorReason)
          : 'session-not-found',
      );
      return;
    }
    if (msg.reason === 'removed') {
      this.onRemoved();
    } else if (msg.reason === 'unknown-token') {
      // the host no longer knows this person: this device's record is useless
      if (this.sessionId) this.store.removeParticipantRecord(this.sessionId);
      this.fail('session-not-found');
    } else if (msg.reason === 'version') {
      this.fail('version');
    }
  }

  // ---- helpers ----------------------------------------------------------------------------

  private persist(): void {
    if (!this.sessionId || !this.token || !this.participantId) return;
    const record: ParticipantRecord = {
      token: this.token,
      participantId: this.participantId,
      name: this.name,
      role: this.role,
      lastState: this.state,
      lastSeq: this.lastSeq,
      outbox: this.outbox,
      leftLocally: this.leftLocally,
    };
    this.store.saveParticipantRecord(this.sessionId, record);
  }

  private emit(): void {
    const snap = this.snapshot;
    for (const cb of this.changeCbs) cb(snap);
  }

  private shutdown(status: ClientStatus): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.reconnectTimer = null;
    this.hintTimer = null;
    const conn = this.conn;
    this.conn = null;
    conn?.close();
    this.transport.stop();
    this.status = status;
    this.emit();
  }
}
