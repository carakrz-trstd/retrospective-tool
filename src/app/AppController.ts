// The application layer: ties the router, the local storage, the tab guard, the host controller
// (Facilitator) and the client controller (participant) to a few signals that the screens read.

import {
  ClientController,
  ClientFailure,
  type ClientSnapshot,
  type ClientStatus,
} from '../client/ClientController';
import { overlayState } from '../contrib/overlay';
import { collectEndGuardMessages } from '../core/registry';
import { buildDocumentModel } from '../doc/build';
import { parseFinalPayload, registerDocEnd } from '../doc/endIntegration';
import { loadFinal, markExported, saveFinal } from '../doc/finalStore';
import { noExports, type DocumentModel, type ExportKind, type FinalRecord } from '../doc/model';
import type { SurveyAnswer } from '../contrib/types';
import { createUuid } from '../core/ids';
import type { SessionState } from '../core/types';
import { registerFlow } from '../flow';
import { HostClock } from '../flow/clock';
import { FLOW_KEY, getFlow, initialFlow } from '../flow/flowState';
import { getLocalMuted, setLocalMuted as saveLocalMuted } from '../flow/prefs';
import { SoundPlayer, installUnlockOnFirstGesture } from '../flow/sound';
import { suggestedMs } from '../flow/suggested';
import type { FlowState, StopId } from '../flow/types';
import type { ChosenFormat } from '../formats/types';
import { FormatFlow } from '../ui/format/flow';
import { HostController, type ListeningStatus } from '../host/HostController';
import type { Identity, LocalSurvey, Store } from '../storage/storage';
import type { TabGuard } from '../tabs/TabGuard';
import type { Transport } from '../transport/Transport';
import { texts } from '../texts';
import { ref } from '../ui/ref';
import { joinLink, newHash, type Route, type Router } from './router';

export type Screen = 'home' | 'new' | 'create' | 'join' | 'lobby' | 'session' | 'ended' | 'removed';

export interface AppServices {
  createTransport: () => Transport;
  store: Store;
  tabGuard: TabGuard;
  router: Router;
  /** The page address without the hash, used for the join link. */
  baseUrl: () => string;
  hostOfflineHintMs?: number;
  /** The end-of-time beep (tests inject a fake). */
  sound?: Pick<SoundPlayer, 'unlock' | 'beep'>;
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

  /** The format selection (questionnaire, suggestion, library, custom format). */
  readonly flow: FormatFlow;

  /** Estimates the host's time on this device (the Facilitator's device uses its own clock). */
  clock = new HostClock();
  readonly sound: Pick<SoundPlayer, 'unlock' | 'beep'>;
  /** This device's own sound mute (stored in retro.prefs). */
  readonly localMuted = ref(getLocalMuted());
  /** This device's own survey answer and its random answer key (never stored with a participant ID). */
  readonly mySurvey = ref<LocalSurvey | null>(null);
  /** How many refused changes the person has already been told about. */
  readonly rejectedSeen = ref(0);
  /** The final documentation kept on this device, with the exports done so far. */
  readonly docRecord = ref<FinalRecord | null>(null);
  /** False when the browser would not store the documentation (a reload would lose it). */
  readonly docPersisted = ref(true);
  /** The stop at which the Facilitator is told that the entries became visible (AD-16). */
  readonly revealNoteStop = ref<StopId | null>(null);

  constructor(private readonly services: AppServices) {
    registerFlow();
    registerDocEnd();
    this.sound = services.sound ?? new SoundPlayer();
    this.flow = new FormatFlow({
      onChosen: (chosen) => this.onFormatChosen(chosen),
      onStep: (step, formatId) => this.services.router.replace(newHash(step, formatId)),
    });
  }

  // ---- start ------------------------------------------------------------------------------

  boot(): void {
    const { store, router } = this.services;
    router.subscribe((route) => this.onRouteChange(route));
    this.storageOk.set(store.isAvailable());
    store.sweepExpired();
    store.deleteUnreadable();
    if (!this.services.sound && typeof window !== 'undefined') installUnlockOnFirstGesture(this.sound);
    this.refreshOffers();
    this.identity.set(store.loadIdentity());

    const route = router.current();
    if (route.name === 'new') {
      this.enterNew(route);
      return;
    }
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
    if (route.name === 'create') this.goCreate();
    else this.screen.set('home');
  }

  /** The address bar changed (for example somebody pasted a join link into this tab). */
  onRouteChange(route: Route): void {
    // inside a session the screen follows the session, not the address bar
    if (this.host || this.client) return;
    if (route.name === 'join') {
      if (route.target) this.joinTarget.set(route.target);
      this.screen.set('join');
    } else if (route.name === 'new') {
      this.enterNew(route);
    } else if (route.name === 'create') {
      if (this.flow.chosen.value) this.screen.set('create');
      else this.goNew();
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

  /** The address points into the format selection: show it (or start over when data is missing). */
  private enterNew(route: Extract<Route, { name: 'new' }>): void {
    if (route.step === 'details' && route.formatId) this.flow.detailsId.set(route.formatId);
    this.flow.guard(route.step);
    this.screen.set('new');
  }

  /** "Create session" starts with the format selection. */
  goNew(): void {
    this.detach();
    this.sessionId = null;
    this.formError.set(null);
    this.flow.reset();
    this.screen.set('new');
  }

  /** The format is chosen: now the Facilitator enters name, role and an optional title. */
  private onFormatChosen(_chosen: ChosenFormat): void {
    this.formError.set(null);
    this.services.router.replace('#/create');
    this.screen.set('create');
  }

  goCreate(): void {
    if (!this.flow.chosen.value) return this.goNew();
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
    const chosen = this.flow.chosen.value;
    if (!chosen) return this.goNew();
    this.sound.unlock();
    this.busy.set(true);
    const host = HostController.create(
      {
        name: input.name,
        role: input.role,
        title: input.title,
        format: chosen.format,
        timeBudgetMin: chosen.timeBudgetMin,
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
    this.clock = new HostClock({ isHost: true });
    this.sessionId = host.data.state.sessionId;
    this.role.set('host');
    this.myParticipantId.set(host.facilitatorId);
    this.services.store.setActiveSession(this.sessionId);
    this.services.router.replace('#/session');
    this.mySurvey.set(this.services.store.loadHostSurvey(this.sessionId));
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
    if (view.status === 'ended') this.ensureHostFinal();
    this.screen.set(screenFor(view.status));
  }

  startSession(): void {
    this.host?.startSession();
  }

  /** Warnings before the session ends. The guards look at the host's full state: the Facilitator's own view hides entries of others. */
  endGuardMessages(): string[] {
    return this.host ? collectEndGuardMessages(this.host.data.state) : [];
  }

  endSession(): void {
    this.host?.endSession();
  }

  removeParticipant(participantId: string): void {
    this.host?.removeParticipant(participantId);
  }

  // ---- guided flow (Epic 3) -----------------------------------------------------------------

  /** The flow of the session as this device sees it. */
  flowState(): FlowState {
    const s = this.state.value;
    return s ? getFlow(s) : initialFlow();
  }

  /** The Facilitator's contribution counts (only present in the Facilitator's view). */
  flowCounts(): Partial<Record<'checkIn' | 'retro', { added: number; total: number }>> {
    const slice = this.state.value?.extensions[FLOW_KEY] as { counts?: Record<string, never> } | undefined;
    return (slice?.counts ?? {}) as never;
  }

  /** The suggested time of a stop, from the chosen format and the time budget. */
  stopDuration(stop: StopId): number {
    const s = this.state.value;
    return s ? suggestedMs(stop, s.format, s.timeBudgetMin) : 0;
  }

  /** A flow action of the Facilitator (Facilitator-only: only the host device sends them). */
  flowIntent(kind: string, payload: unknown = {}): boolean {
    const host = this.host;
    if (!host) return false;
    const before = getFlow(host.view()).revealed.retro;
    const result = host.applyLocalIntent(kind, payload);
    if (!result.ok) return false;
    const after = getFlow(host.view());
    const moves = kind === 'flow.next' || kind === 'flow.prev' || kind === 'flow.goto';
    this.revealNoteStop.set(moves && !before && after.revealed.retro ? after.stop : null);
    return true;
  }

  /** An intent of a later module: the Facilitator applies it locally, a participant sends it to the host. */
  sendIntent(kind: string, payload: unknown): void {
    if (this.host) this.host.applyLocalIntent(kind, payload);
    else this.client?.sendIntent(kind, payload);
  }

  /** Answers or changes the answer of the exit survey from this device. */
  submitSurvey(answer: SurveyAnswer): void {
    if (this.host) {
      const sessionId = this.host.data.state.sessionId;
      const answerKey = this.mySurvey.value?.answerKey ?? createUuid();
      const local = { answerKey, answer };
      this.services.store.saveHostSurvey(sessionId, local);
      this.mySurvey.set(local);
      this.host.applyLocalIntent('survey.submit', { answerKey, answer });
    } else {
      this.client?.submitSurvey(answer);
    }
  }

  /** The person has seen the message about refused changes. */
  dismissRejected(): void {
    this.rejectedSeen.set(this.rejectedOps.value.length);
  }

  setLocalMuted(muted: boolean): void {
    this.localMuted.set(muted);
    saveLocalMuted(muted);
  }

  // ---- participant --------------------------------------------------------------------------

  async join(target: string, name: string, role: string): Promise<void> {
    this.formError.set(null);
    if (!name.trim()) return void this.formError.set(texts.nameRequired);
    if (!role.trim()) return void this.formError.set(texts.roleRequired);
    this.sound.unlock();
    this.busy.set(true);
    const client = ClientController.join(target, { name, role }, this.clientOptions());
    this.watchClock(client);
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
    this.watchClock(client);
    this.attachClient(client, sessionId);
  }

  /** Every host message carries the host's time; it feeds the clock estimate (also the first one). */
  private watchClock(client: ClientController): void {
    const clock = new HostClock();
    this.clock = clock;
    client.onHostTime((hostTime, receivedAt) => clock.observe(hostTime, receivedAt));
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
    const stored = this.sessionId ? loadFinal(this.sessionId, this.services.store) : null;
    if (stored) this.docRecord.set(stored);
    this.unsubs.push(
      client.onChange((s) => this.syncClient(s)),
      client.onEnded((payload) => this.onEnded(payload)),
    );
    this.syncClient(snap);
  }

  private syncClient(snap: ClientSnapshot): void {
    this.myParticipantId.set(snap.participantId);
    // own writes the host has not confirmed yet are shown on top of the last received state
    this.state.set(
      overlayState(
        snap.state,
        snap.outbox,
        { participantId: snap.participantId, isFacilitator: false },
        Date.now(),
      ),
    );
    this.mySurvey.set(snap.surveyLocal);
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
    else if (this.docRecord.value) this.screen.set('ended');
    else this.screen.set(snap.state ? screenFor(snap.state.status) : 'lobby');
  }

  /** "Leave session": closes the session on this device only; the person can rejoin later. */
  leave(): void {
    this.client?.leave();
  }

  // ---- ending -------------------------------------------------------------------------------

  /** Called when a person is done with an ended session (Epic 5: after leaving the documentation). */
  finishEnded(): void {
    const sessionId = this.sessionId ?? this.state.value?.sessionId ?? null;
    this.detach();
    if (sessionId) {
      this.services.store.removeSession(sessionId);
      this.services.tabGuard.release(sessionId);
    }
    this.goHome();
  }

  // ---- documentation (Epic 5) ----------------------------------------------------------------

  /** Shows the documentation page for a record (kept on this device). */
  openDocumentation(record: FinalRecord, persisted = true): void {
    this.docRecord.set(record);
    this.docPersisted.set(persisted);
    this.screen.set('ended');
  }

  /** Stores the final model (the export marks of an earlier copy stay) and shows it. */
  private receiveFinal(model: DocumentModel): void {
    const sessionId = this.sessionId ?? this.state.value?.sessionId;
    if (!sessionId) return;
    const { store } = this.services;
    const persisted = saveFinal(sessionId, model, store);
    const record = loadFinal(sessionId, store) ?? {
      model,
      exports: this.docRecord.value?.exports ?? noExports(),
    };
    this.openDocumentation(record, persisted);
  }

  /** The host said the session ended: keep the documentation it sent. */
  private onEnded(payload: unknown): void {
    const model = parseFinalPayload(payload);
    const state = this.state.value;
    if (model) this.receiveFinal(model);
    else if (state) this.receiveFinal(buildDocumentModel(state, { incomplete: true }));
  }

  /** The Facilitator's own device builds the documentation from its full state when the session has ended. */
  private ensureHostFinal(): void {
    if (!this.host || this.docRecord.value) return;
    const state = this.host.data.state;
    const existing = loadFinal(state.sessionId, this.services.store);
    if (existing) this.openDocumentation(existing);
    else this.receiveFinal(buildDocumentModel(state, { incomplete: false }));
  }

  /** The Facilitator stayed away: build the documentation from what this device holds. */
  openIncompleteDocumentation(): void {
    const state = this.state.value;
    if (state) this.receiveFinal(buildDocumentModel(state, { incomplete: true }));
  }

  markExport(kind: ExportKind): void {
    const record = this.docRecord.value;
    const sessionId = this.sessionId ?? this.state.value?.sessionId;
    if (!record || !sessionId) return;
    const next = markExported(sessionId, kind, this.services.store) ?? {
      ...record,
      exports: { ...record.exports, [kind]: true },
    };
    this.docRecord.set(next);
  }

  /** The person leaves the documentation: everything this device keeps for the session is removed. */
  leaveDocumentation(): void {
    this.finishEnded();
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
    this.docRecord.set(null);
    this.docPersisted.set(true);
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
