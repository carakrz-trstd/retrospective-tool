// The application layer: ties the router, the local storage, the tab guard, the host controller
// (Facilitator) and the client controller (participant) to a few signals that the screens read.

import { signal, type Signal } from '@preact/signals';
import {
  ClientController,
  ClientFailure,
  type ClientSnapshot,
  type ClientStatus,
} from '../client/ClientController';
import { placeholderFormat, placeholderTimeBudget } from '../core/placeholderFormat';
import type { SessionState } from '../core/types';
import { HostController, type ListeningStatus } from '../host/HostController';
import type { Identity, Store } from '../storage/storage';
import type { TabGuard } from '../tabs/TabGuard';
import type { Transport } from '../transport/Transport';
import { texts } from '../texts';
import { joinLink, type Route, type Router } from './router';

export type Screen = 'home' | 'create' | 'join' | 'lobby' | 'session' | 'ended' | 'removed';

export interface AppServices {
  createTransport: () => Transport;
  store: Store;
  tabGuard: TabGuard;
  router: Router;
  /** The page address without the hash, used for the join link. */
  baseUrl: () => string;
  hostOfflineHintMs?: number;
}

export interface ConnectionInfo {
  /** 'host' for the Facilitator's own device. */
  status: ClientStatus | 'host';
  longOffline: boolean;
  /** The host waits for the broker to release its ID. */
  hostWaiting: boolean;
  /** This tab was taken over by another tab. */
  readOnly: boolean;
}

export interface HostOffer {
  sessionId: string;
  title?: string;
  joinCode: string;
  status: SessionState['status'];
  participants: number;
  savedAt: number;
}

export interface RejoinOffer {
  sessionId: string;
  name: string;
  role: string;
  savedAt: number;
}

const idleConnection: ConnectionInfo = {
  status: 'connecting',
  longOffline: false,
  hostWaiting: false,
  readOnly: false,
};

export class AppController {
  readonly screen = ref<Screen>('home');
  readonly joinTarget = ref('');
  readonly state = ref<SessionState | null>(null);
  readonly role = ref<'host' | 'participant' | null>(null);
  readonly myParticipantId = ref<string | null>(null);
  readonly connection = ref<ConnectionInfo>(idleConnection);
  readonly formError = ref<string | null>(null);
  readonly busy = ref(false);
  readonly takeOverPrompt = ref<string | null>(null);
  readonly hostOffers = ref<HostOffer[]>([]);
  readonly rejoinOffers = ref<RejoinOffer[]>([]);
  readonly identity = ref<Identity | null>(null);
  readonly storageOk = ref(true);
  /** Messages for the person, for example refused writes (shown by later epics). */
  readonly rejectedOps = ref<ClientSnapshot['rejectedOps']>([]);

  private host: HostController | null = null;
  private client: ClientController | null = null;
  private unsubs: (() => void)[] = [];
  private sessionId: string | null = null;

  constructor(private readonly services: AppServices) {}

  // ---- start ------------------------------------------------------------------------------

  boot(): void {
    const { store, router } = this.services;
    router.subscribe((route) => this.onRouteChange(route));
    this.storageOk.set(store.isAvailable());
    store.sweepExpired();
    store.deleteUnreadable();
    this.refreshOffers();
    this.identity.set(store.loadIdentity());

    const route = router.current();
    if (route.name === 'join') {
      this.joinTarget.set(route.target);
      this.screen.set('join');
      return;
    }
    // a reload in the same tab: participants rejoin by themselves (Facilitators are offered to resume)
    const active = store.getActiveSession();
    if (active && store.loadParticipantRecord(active) && !store.loadHostRecord(active)) {
      this.rejoin(active);
      return;
    }
    this.screen.set(route.name === 'create' ? 'create' : 'home');
  }

  /** The address bar changed (for example somebody pasted a join link into this tab). */
  onRouteChange(route: Route): void {
    // inside a session the screen follows the session, not the address bar
    if (this.host || this.client) return;
    if (route.name === 'join') {
      if (route.target) this.joinTarget.set(route.target);
      this.screen.set('join');
    } else if (route.name === 'create') {
      this.screen.set('create');
    } else if (route.name === 'home') {
      this.refreshOffers();
      this.screen.set('home');
    }
  }

  private refreshOffers(): void {
    const { store } = this.services;
    const hosts: HostOffer[] = [];
    const rejoins: RejoinOffer[] = [];
    for (const entry of store.listIndex()) {
      if (entry.sessionId === this.sessionId) continue;
      if (entry.role === 'host') {
        const data = store.loadHostRecord(entry.sessionId);
        if (!data) continue;
        hosts.push({
          sessionId: entry.sessionId,
          title: data.state.title,
          joinCode: data.state.joinCode,
          status: data.state.status,
          participants: Object.values(data.state.participants).filter((p) => p.status === 'active').length,
          savedAt: entry.savedAt,
        });
      } else {
        const rec = store.loadParticipantRecord(entry.sessionId);
        if (!rec) continue;
        rejoins.push({ sessionId: entry.sessionId, name: rec.name, role: rec.role, savedAt: entry.savedAt });
      }
    }
    this.hostOffers.set(hosts);
    this.rejoinOffers.set(rejoins);
  }

  goHome(): void {
    this.detach();
    this.sessionId = null;
    this.formError.set(null);
    this.services.router.replace('#/');
    this.refreshOffers();
    this.identity.set(this.services.store.loadIdentity());
    this.screen.set('home');
  }

  goCreate(): void {
    this.formError.set(null);
    this.services.router.replace('#/create');
    this.screen.set('create');
  }

  goJoin(target = ''): void {
    this.formError.set(null);
    this.joinTarget.set(target);
    this.services.router.replace('#/join');
    this.screen.set('join');
  }

  forgetIdentity(): void {
    this.services.store.forgetIdentity();
    this.identity.set(null);
  }

  discardOffer(sessionId: string): void {
    this.services.store.removeSession(sessionId);
    this.refreshOffers();
  }

  // ---- Facilitator --------------------------------------------------------------------------

  async createSession(input: { name: string; role: string; title?: string }): Promise<void> {
    this.formError.set(null);
    if (!input.name.trim()) return void this.formError.set(texts.nameRequired);
    if (!input.role.trim()) return void this.formError.set(texts.roleRequired);
    this.busy.set(true);
    const host = HostController.create(
      {
        name: input.name,
        role: input.role,
        title: input.title,
        format: placeholderFormat,
        timeBudgetMin: placeholderTimeBudget,
      },
      { transport: this.services.createTransport(), store: this.services.store },
    );
    const sessionId = host.data.state.sessionId;
    await this.services.tabGuard.acquireHost(sessionId);
    try {
      await host.ready;
    } catch {
      host.stop();
      this.services.tabGuard.release(sessionId);
      this.busy.set(false);
      this.formError.set(texts.unavailable);
      return;
    }
    this.services.store.saveIdentity({ name: input.name.trim(), role: input.role.trim() });
    this.attachHost(host);
    this.busy.set(false);
  }

  /** Resumes a session this device hosted. When another tab hosts it, asks first (take over). */
  async resume(sessionId: string): Promise<void> {
    this.formError.set(null);
    const record = this.services.store.loadHostRecord(sessionId);
    if (!record) {
      this.refreshOffers();
      return;
    }
    const acquired = await this.services.tabGuard.acquireHost(sessionId);
    if (acquired === 'taken') {
      this.takeOverPrompt.set(sessionId);
      return;
    }
    this.startResumed(sessionId);
  }

  async confirmTakeOver(): Promise<void> {
    const sessionId = this.takeOverPrompt.value;
    if (!sessionId) return;
    this.busy.set(true);
    const result = await this.services.tabGuard.requestTakeOver(sessionId);
    this.busy.set(false);
    this.takeOverPrompt.set(null);
    if (result === 'acquired') this.startResumed(sessionId);
    else this.formError.set(texts.takeOverFailed);
  }

  cancelTakeOver(): void {
    this.takeOverPrompt.set(null);
  }

  private startResumed(sessionId: string): void {
    const record = this.services.store.loadHostRecord(sessionId);
    if (!record) return;
    const host = HostController.resume(record, {
      transport: this.services.createTransport(),
      store: this.services.store,
    });
    this.attachHost(host);
    host.ready.catch(() => this.formError.set(texts.unavailable));
  }

  private attachHost(host: HostController): void {
    this.detach();
    this.host = host;
    this.sessionId = host.data.state.sessionId;
    this.role.set('host');
    this.myParticipantId.set(host.facilitatorId);
    this.services.store.setActiveSession(this.sessionId);
    this.services.router.replace('#/session');
    const sessionId = this.sessionId;
    this.unsubs.push(
      host.onChange(() => this.syncHost()),
      host.onListeningStatus((s) => this.setHostConnection(s)),
      this.services.tabGuard.onTakenOver((id) => {
        if (id !== sessionId) return;
        this.host?.stop();
        this.connection.set({ ...this.connection.value, readOnly: true });
      }),
    );
    this.syncHost();
  }

  private setHostConnection(s: ListeningStatus): void {
    this.connection.set({
      ...this.connection.value,
      status: 'host',
      hostWaiting: s === 'waiting',
    });
  }

  private syncHost(): void {
    if (!this.host) return;
    const view = this.host.view();
    this.state.set(view);
    this.screen.set(screenFor(view.status));
  }

  startSession(): void {
    this.host?.startSession();
  }

  endSession(): void {
    this.host?.endSession();
  }

  removeParticipant(participantId: string): void {
    this.host?.removeParticipant(participantId);
  }

  // ---- participant --------------------------------------------------------------------------

  async join(target: string, name: string, role: string): Promise<void> {
    this.formError.set(null);
    if (!name.trim()) return void this.formError.set(texts.nameRequired);
    if (!role.trim()) return void this.formError.set(texts.roleRequired);
    this.busy.set(true);
    const client = ClientController.join(target, { name, role }, this.clientOptions());
    try {
      await client.ready;
    } catch (err) {
      this.busy.set(false);
      this.formError.set(failureText(err));
      return;
    }
    this.attachClient(client);
    this.busy.set(false);
  }

  rejoin(sessionId: string): void {
    this.formError.set(null);
    let client: ClientController;
    try {
      client = ClientController.rejoin(sessionId, this.clientOptions());
    } catch {
      this.refreshOffers();
      return;
    }
    this.attachClient(client, sessionId);
  }

  private clientOptions() {
    return {
      transport: this.services.createTransport(),
      store: this.services.store,
      hostOfflineHintMs: this.services.hostOfflineHintMs,
    };
  }

  private attachClient(client: ClientController, sessionId?: string): void {
    this.detach();
    this.client = client;
    this.role.set('participant');
    const snap = client.snapshot;
    this.sessionId = sessionId ?? snap.state?.sessionId ?? null;
    this.services.router.replace('#/session');
    this.unsubs.push(client.onChange((s) => this.syncClient(s)));
    this.syncClient(snap);
  }

  private syncClient(snap: ClientSnapshot): void {
    this.myParticipantId.set(snap.participantId);
    this.state.set(snap.state);
    this.rejectedOps.set(snap.rejectedOps);
    this.connection.set({
      status: snap.status,
      longOffline: snap.longOffline,
      hostWaiting: false,
      readOnly: false,
    });
    if (snap.status === 'removed') this.screen.set('removed');
    else if (snap.status === 'ended' || snap.state?.status === 'ended') this.screen.set('ended');
    else if (snap.status === 'left') this.goHome();
    else this.screen.set(snap.state ? screenFor(snap.state.status) : 'lobby');
  }

  /** "Leave session": closes the session on this device only; the person can rejoin later. */
  leave(): void {
    this.client?.leave();
  }

  // ---- ending -------------------------------------------------------------------------------

  /** Called when a person is done with an ended session (Epic 5: after leaving the documentation). */
  finishEnded(): void {
    const sessionId = this.sessionId;
    this.detach();
    if (sessionId) {
      this.services.store.removeSession(sessionId);
      this.services.tabGuard.release(sessionId);
    }
    this.goHome();
  }

  /** The page is going away: close the connections now (the session is already saved). */
  closeConnections(): void {
    this.host?.stop();
    this.client?.stop();
  }

  private detach(): void {
    for (const u of this.unsubs.splice(0)) u();
    this.host?.stop();
    this.client?.stop();
    this.host = null;
    this.client = null;
    this.state.set(null);
    this.role.set(null);
    this.myParticipantId.set(null);
    this.connection.set(idleConnection);
    this.takeOverPrompt.set(null);
  }

  // ---- helpers for the screens --------------------------------------------------------------

  /** The link and the code the Facilitator shares. */
  invitation(): { link: string; code: string } | null {
    const s = this.state.value;
    if (!s) return null;
    return { link: joinLink(this.services.baseUrl(), s.sessionId), code: s.joinCode };
  }
}

function screenFor(status: SessionState['status']): Screen {
  if (status === 'lobby') return 'lobby';
  if (status === 'running') return 'session';
  return 'ended';
}

function failureText(err: unknown): string {
  if (err instanceof ClientFailure) {
    switch (err.reason) {
      case 'session-not-found':
        return texts.sessionNotFound;
      case 'session-ended':
        return texts.sessionEnded;
      case 'name-required':
        return texts.nameRequired;
      case 'role-required':
        return texts.roleRequired;
      case 'version':
        return texts.versionMismatch;
      default:
        return texts.unavailable;
    }
  }
  return texts.unavailable;
}

/** A signal with a set() method, so the controller code reads "x.set(value)". */
type Ref<T> = Signal<T> & { set(value: T): void };

function ref<T>(initial: T): Ref<T> {
  const s = signal(initial);
  return Object.assign(s, {
    set(value: T) {
      s.value = value;
    },
  });
}
