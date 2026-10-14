// The Facilitator's browser is the host of the live session (host-authoritative state).
// It listens for participants, applies their intents, filters what each participant may see
// (viewFor), sends snapshots and item-level updates, and saves everything locally so that a
// closed browser can resume with the same link.

import { diffViews } from '../core/diff';
import { createJoinCode, createSessionId, createUuid, normalizeJoinCode } from '../core/ids';
import { resolverPeerId, sessionPeerId } from '../core/peerIds';
import { PROTOCOL_VERSION, type ClientMessage, type HostMessage, isClientMessage } from '../core/protocol';
import { getIntentHandler, isAnonymousIntent } from '../core/registry';
import * as reducer from '../core/reducer';
import type { CreateSessionInput } from '../core/reducer';
import type { Effect, HostData, ReduceResult, SessionState } from '../core/types';
import { viewFor } from '../core/view';
import { config as defaultConfig } from '../config';
import { store as defaultStore, type Store } from '../storage/storage';
import { isIdTaken, type Connection, type Transport } from '../transport/Transport';

const MAX_REMEMBERED_OPS = 500;
const LOOKUP_WINDOW_MS = 60_000;
const LOOKUP_DELAY_MS = 1_000;
const RESOLVER_CLOSE_DELAY_MS = 2_000;
const RESOLVER_ATTEMPTS = 5;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export type ListeningStatus = 'starting' | 'online' | 'waiting' | 'stopped';

export interface HostOptions {
  transport: Transport;
  store?: Store;
  now?: () => number;
  newId?: () => string;
  newToken?: () => string;
  maxLookupsPerMinute?: number;
}

export type LocalIntentResult = { ok: true } | { ok: false; reason: string };

interface ConnState {
  conn: Connection;
  participantId: string | null;
  seq: number;
  lastView: SessionState | null;
  replaced: boolean;
}

export type HostCreateInput = Omit<CreateSessionInput, 'sessionId' | 'joinCode'> & {
  sessionId?: string;
  joinCode?: string;
};

export class HostController {
  /** Resolves when the host listens on its IDs. */
  ready!: Promise<void>;

  private _data: HostData;
  private readonly transport: Transport;
  private readonly store: Store;
  private readonly now: () => number;
  private readonly newId?: () => string;
  private readonly newToken?: () => string;
  private readonly maxLookups: number;
  private conns = new Set<ConnState>();
  private bound = new Map<string, ConnState>();
  private changeCbs = new Set<(data: HostData) => void>();
  private statusCbs = new Set<(s: ListeningStatus) => void>();
  private lookupTimes: number[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private _status: ListeningStatus = 'starting';
  private stopped = false;
  readonly facilitatorId: string;

  private constructor(data: HostData, opts: HostOptions) {
    this._data = data;
    this.transport = opts.transport;
    this.store = opts.store ?? defaultStore;
    this.now = opts.now ?? (() => Date.now());
    this.newId = opts.newId;
    this.newToken = opts.newToken;
    this.maxLookups = opts.maxLookupsPerMinute ?? defaultConfig.maxLookupsPerMinute;
    const facilitator = Object.values(data.state.participants).find((p) => p.isFacilitator);
    if (!facilitator) throw new Error('Session without Facilitator');
    this.facilitatorId = facilitator.id;
  }

  /** Starts a new session. `ready` resolves when the host listens (the join code may change before that). */
  static create(input: HostCreateInput, opts: HostOptions): HostController {
    const now = (opts.now ?? (() => Date.now()))();
    const sessionId = input.sessionId ?? createSessionId();
    const created = reducer.createSession(
      { ...input, sessionId, joinCode: input.joinCode ?? createJoinCode() },
      { now, newId: opts.newId },
    );
    const host = new HostController(created.data, opts);
    host.ready = host.openNew(input.joinCode === undefined);
    return host;
  }

  /** Resumes a session from the record this device saved. */
  static resume(data: HostData, opts: HostOptions): HostController {
    const host = new HostController(structuredClone(data), opts);
    host.ready = host.openResume();
    return host;
  }

  // ---- public state ---------------------------------------------------------------------

  get data(): HostData {
    return this._data;
  }

  get listeningStatus(): ListeningStatus {
    return this._status;
  }

  /** The Facilitator's own view of the session. */
  view(): SessionState {
    return viewFor(this._data.state, this.facilitatorId);
  }

  onChange(cb: (data: HostData) => void): () => void {
    this.changeCbs.add(cb);
    return () => this.changeCbs.delete(cb);
  }

  onListeningStatus(cb: (s: ListeningStatus) => void): () => void {
    this.statusCbs.add(cb);
    cb(this._status);
    return () => this.statusCbs.delete(cb);
  }

  // ---- Facilitator actions (local) --------------------------------------------------------

  startSession(): LocalIntentResult {
    return this.applyBuiltIn(this.facilitatorId, 'session.start', {});
  }

  endSession(): LocalIntentResult {
    return this.applyBuiltIn(this.facilitatorId, 'session.end', {});
  }

  removeParticipant(participantId: string): LocalIntentResult {
    return this.applyBuiltIn(this.facilitatorId, 'session.remove', { participantId });
  }

  /** An intent by the Facilitator themself (the Facilitator takes part like everybody else). */
  applyLocalIntent(kind: string, payload: unknown, opId: string = createUuid()): LocalIntentResult {
    const res = this.applyIntent(this.facilitatorId, kind, payload, opId);
    return res.ok ? { ok: true } : { ok: false, reason: res.reason };
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.transport.stop();
    this.setStatus('stopped');
  }

  // ---- opening ----------------------------------------------------------------------------

  private setStatus(s: ListeningStatus): void {
    this._status = s;
    for (const cb of this.statusCbs) cb(s);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        resolve();
      }, ms);
      this.timers.add(t);
    });
  }

  private async openNew(generateCode: boolean): Promise<void> {
    // Claim a free resolver ID: when it is taken (another session uses the same code), use a new code.
    let attempts = 0;
    for (;;) {
      try {
        await this.transport.listen(resolverPeerId(this._data.state.joinCode), (c) =>
          this.onResolverConnection(c),
        );
        break;
      } catch (err) {
        if (!isIdTaken(err) || ++attempts >= RESOLVER_ATTEMPTS) throw err;
        const code = generateCode ? createJoinCode() : createJoinCode(); // a given code that is taken is replaced as well
        this._data = { ...this._data, state: { ...this._data.state, joinCode: normalizeJoinCode(code) } };
      }
    }
    await this.transport.listen(sessionPeerId(this._data.state.sessionId), (c) =>
      this.onSessionConnection(c),
    );
    this.persist();
    this.setStatus('online');
  }

  private async openResume(): Promise<void> {
    await this.listenWithBackoff(resolverPeerId(this._data.state.joinCode), (c) =>
      this.onResolverConnection(c),
    );
    await this.listenWithBackoff(sessionPeerId(this._data.state.sessionId), (c) =>
      this.onSessionConnection(c),
    );
    this.persist();
    if (!this.stopped) this.setStatus('online');
  }

  /** The broker may still hold the old registration of a crashed host: retry until it is free. */
  private async listenWithBackoff(id: string, onConnection: (c: Connection) => void): Promise<void> {
    for (let attempt = 0; !this.stopped; attempt++) {
      try {
        await this.transport.listen(id, onConnection);
        return;
      } catch (err) {
        if (!isIdTaken(err)) throw err;
        this.setStatus('waiting');
        await this.sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!);
      }
    }
  }

  // ---- messages out -----------------------------------------------------------------------

  private send(cs: ConnState, msg: Omit<HostMessage, 'v' | 'hostTime'> & Record<string, unknown>): void {
    cs.conn.send({ v: PROTOCOL_VERSION, hostTime: this.now(), ...msg });
  }

  private sendSnapshot(cs: ConnState, token?: string): void {
    const pid = cs.participantId!;
    const view = viewFor(this._data.state, pid);
    cs.lastView = view;
    this.send(cs, {
      type: 'welcome',
      ...(token ? { token } : {}),
      participantId: pid,
      seq: cs.seq,
      state: view,
    });
    if (this._data.state.status === 'ended') this.send(cs, { type: 'ended' });
  }

  /** Sends each connected participant the difference to what they saw before. */
  private broadcast(): void {
    for (const cs of this.bound.values()) {
      if (cs.replaced || !cs.lastView || !cs.participantId) continue;
      const next = viewFor(this._data.state, cs.participantId);
      const changes = diffViews(cs.lastView, next);
      cs.lastView = next;
      if (changes.length === 0) continue;
      cs.seq += 1;
      this.send(cs, { type: 'update', seq: cs.seq, rev: this._data.state.rev, changes });
    }
  }

  private persist(): void {
    this.store.saveHostRecord(this._data);
    for (const cb of this.changeCbs) cb(this._data);
  }

  private commit(data: HostData, effects: Effect[] = []): void {
    this._data = data;
    this.persist();
    for (const effect of effects) {
      if (effect.type === 'disconnect') {
        const cs = this.bound.get(effect.participantId);
        if (cs) {
          this.send(cs, { type: 'removed' });
          this.bound.delete(effect.participantId);
          cs.participantId = null;
          cs.conn.close();
        }
      }
    }
    this.broadcast();
  }

  // ---- applying intents -------------------------------------------------------------------

  private applyBuiltIn(actorId: string, kind: string, payload: unknown): LocalIntentResult {
    const res = this.runBuiltIn(actorId, kind, payload);
    if (!res) return { ok: false, reason: 'unknown-intent' };
    if (!res.ok) return { ok: false, reason: res.reason };
    const wasEnded = this._data.state.status !== 'ended' && res.data.state.status === 'ended';
    this.commit(res.data, res.effects);
    if (wasEnded) {
      for (const cs of this.bound.values()) this.send(cs, { type: 'ended' });
    }
    return { ok: true };
  }

  private runBuiltIn(actorId: string, kind: string, payload: unknown): ReduceResult | null {
    const ctx = { now: this.now(), newId: this.newId, newToken: this.newToken };
    switch (kind) {
      case 'session.start':
        return reducer.start(this._data, actorId, ctx);
      case 'session.end':
        return reducer.end(this._data, actorId, ctx);
      case 'session.remove': {
        const target = (payload as { participantId?: unknown } | null)?.participantId;
        return typeof target === 'string'
          ? reducer.remove(this._data, actorId, target, ctx)
          : { ok: false, reason: 'unknown-participant', data: this._data };
      }
      default:
        return null;
    }
  }

  /** Applies one intent of a joined participant (built-in or registered by a later epic). */
  private applyIntent(
    senderId: string,
    kind: string,
    payload: unknown,
    opId: string,
  ): { ok: true; duplicate: boolean } | { ok: false; reason: string } {
    if (kind.startsWith('session.')) {
      const res = this.applyBuiltIn(senderId, kind, payload);
      return res.ok ? { ok: true, duplicate: false } : res;
    }
    const handler = getIntentHandler(kind);
    if (!handler) return { ok: false, reason: 'unknown-intent' };
    if (this._data.state.status === 'ended') return { ok: false, reason: 'session-ended' };

    const anonymous = isAnonymousIntent(kind);
    if (!anonymous) {
      const applied = this._data.appliedOps[senderId];
      if (applied?.includes(opId)) return { ok: true, duplicate: true };
    }
    const result = handler({
      state: this._data.state,
      senderId: anonymous ? null : senderId,
      payload,
      now: this.now(),
      opId,
    });
    if (!result.ok) return { ok: false, reason: result.reason };

    const next: HostData = {
      ...this._data,
      state: { ...result.state, rev: this._data.state.rev + 1 },
    };
    if (!anonymous) {
      const ops = [...(next.appliedOps[senderId] ?? []), opId].slice(-MAX_REMEMBERED_OPS);
      next.appliedOps = { ...next.appliedOps, [senderId]: ops };
    }
    this.commit(next);
    return { ok: true, duplicate: false };
  }

  // ---- connections ------------------------------------------------------------------------

  private onSessionConnection(conn: Connection): void {
    const cs: ConnState = { conn, participantId: null, seq: 0, lastView: null, replaced: false };
    this.conns.add(cs);
    conn.onMessage((msg) => this.onSessionMessage(cs, msg));
    conn.onClose(() => this.onSessionClose(cs));
  }

  private onSessionClose(cs: ConnState): void {
    this.conns.delete(cs);
    const pid = cs.participantId;
    if (!pid || cs.replaced || this.stopped) return;
    if (this.bound.get(pid) !== cs) return;
    this.bound.delete(pid);
    const res = reducer.setPresence(this._data, pid, 'offline', { now: this.now() });
    if (res.ok && res.data !== this._data) this.commit(res.data);
  }

  private rejected(cs: ConnState, reason: string, opId?: string): void {
    this.send(cs, { type: 'rejected', reason, ...(opId ? { opId } : {}) });
  }

  private onSessionMessage(cs: ConnState, raw: unknown): void {
    if (!isClientMessage(raw)) return;
    const msg: ClientMessage = raw;
    if (msg.v !== PROTOCOL_VERSION) {
      this.rejected(cs, 'version');
      return;
    }
    switch (msg.type) {
      case 'join':
        this.handleJoin(cs, msg.name, msg.role);
        break;
      case 'rejoin':
        this.handleRejoin(cs, msg.token);
        break;
      case 'intent':
        this.handleIntent(cs, msg.opId, msg.kind, msg.payload);
        break;
      case 'leave':
        this.handleLeave(cs);
        break;
      case 'resync':
        if (cs.participantId) this.sendSnapshot(cs);
        break;
      default:
        break;
    }
  }

  private bind(cs: ConnState, participantId: string): void {
    const previous = this.bound.get(participantId);
    if (previous && previous !== cs) {
      previous.replaced = true;
      this.bound.delete(participantId);
      previous.conn.close();
    }
    cs.participantId = participantId;
    this.bound.set(participantId, cs);
  }

  private handleJoin(cs: ConnState, name: string, role: string): void {
    if (cs.participantId) return;
    const res = reducer.join(
      this._data,
      { name: String(name ?? ''), role: String(role ?? '') },
      {
        now: this.now(),
        newId: this.newId,
        newToken: this.newToken,
      },
    );
    if (!res.ok) {
      this.rejected(cs, res.reason);
      return;
    }
    this._data = res.data;
    this.persist();
    this.bind(cs, res.participantId!);
    this.sendSnapshot(cs, res.token);
    this.broadcast();
  }

  private handleRejoin(cs: ConnState, token: string): void {
    if (cs.participantId) return;
    const res = reducer.rejoin(this._data, String(token ?? ''), { now: this.now() });
    if (!res.ok) {
      this.rejected(cs, res.reason);
      return;
    }
    const changed = res.data !== this._data;
    this._data = res.data;
    if (changed) this.persist();
    this.bind(cs, res.participantId!);
    this.sendSnapshot(cs);
    this.broadcast();
  }

  private handleLeave(cs: ConnState): void {
    const pid = cs.participantId;
    if (!pid) return;
    const res = reducer.setPresence(this._data, pid, 'offline', { now: this.now() });
    if (res.ok && res.data !== this._data) this.commit(res.data);
  }

  private handleIntent(cs: ConnState, opId: string, kind: string, payload: unknown): void {
    const pid = cs.participantId;
    if (!pid) {
      this.rejected(cs, 'not-joined', opId);
      return;
    }
    const res = this.applyIntent(pid, kind, payload, opId);
    if (!res.ok) {
      this.rejected(cs, res.reason, opId);
      return;
    }
    this.send(cs, { type: 'ack', opId, seq: cs.seq });
  }

  // ---- join code lookup -------------------------------------------------------------------

  private onResolverConnection(conn: Connection): void {
    let answered = false;
    const closeLater = () => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        conn.close();
      }, RESOLVER_CLOSE_DELAY_MS);
      this.timers.add(t);
    };
    const reply = (msg: Record<string, unknown>) =>
      conn.send({ v: PROTOCOL_VERSION, hostTime: this.now(), ...msg });
    conn.onMessage((raw) => {
      if (answered || !isClientMessage(raw) || raw.type !== 'lookup') return;
      answered = true;
      if (raw.v !== PROTOCOL_VERSION) {
        reply({ type: 'notFound' });
        closeLater();
        return;
      }
      const t = this.now();
      this.lookupTimes = this.lookupTimes.filter((x) => t - x < LOOKUP_WINDOW_MS);
      if (this.lookupTimes.length >= this.maxLookups) {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          reply({ type: 'notFound' });
          closeLater();
        }, LOOKUP_DELAY_MS);
        this.timers.add(timer);
        return;
      }
      this.lookupTimes.push(t);
      if (normalizeJoinCode(String(raw.code ?? '')) === this._data.state.joinCode) {
        reply({ type: 'resolved', sessionId: this._data.state.sessionId });
      } else {
        reply({ type: 'notFound' });
      }
      closeLater();
    });
  }
}
