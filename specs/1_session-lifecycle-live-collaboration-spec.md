# Spec: Epic 1 — Session Lifecycle & Live Collaboration

Confidence: 93%

PRD: [1_session-lifecycle-live-collaboration.md](1_session-lifecycle-live-collaboration.md)

## Overview
This spec turns the Epic 1 PRD into an implementable design for a greenfield project (no code and no `.claude/_architecture-guidelines.md` exist yet). It covers:

- Project scaffolding, build and deployment to GitHub Pages
- Identifiers (session ID, join code, participant token) and how a join code is resolved to the host
- The shared session state, its extension points for Epics 3-5, and the host-authoritative logic
- The sync protocol between host and participants
- The transport layer (PeerJS behind a swappable interface) and the client logic for join, rejoin, offline writing and presence
- Local persistence with versioning and expiry
- Single-host protection across browser tabs
- The screens of this epic: home (create / join / resume / rejoin), lobby, session shell, ended screen, connection banner and notices

**Design principle:** all logic that matters (state reducer, visibility filter, join/rejoin rules, persistence, sync) is plain TypeScript with no dependency on the UI framework or on PeerJS. PeerJS, the storage and the tab guard are reached only through small interfaces, so the logic can be tested with an in-memory transport and without real connections.

**Dependencies on other epics' specs:** none. Epic 2 hands over a format and time budget (a placeholder is used until then; see `FormatRef`). Epics 3, 4 and 5 extend the session state and the intent, view-filter, end-guard and removal-hook registries defined here.

## Key Architecture Decisions
| # | Decision | Choice | Rationale | Source |
|---|----------|--------|-----------|--------|
| AD-1 | Language, UI framework, build | TypeScript, Preact, Vite | Fixed in the PRD | PRD NFR-8, Q5 (cycle 1) |
| AD-2 | Hosting and deployment | Static site on GitHub Pages, deployed by a GitHub Actions workflow; hash-based links | Fixed in the PRD; static hosting cannot rewrite paths | PRD NFR-8 |
| AD-3 | Live connection | PeerJS (WebRTC) with its public signaling broker; no server of ours | Fixed in the PRD | PRD Given constraints, Q1 (cycle 1, revised) |
| AD-4 | Broker and STUN servers | Configurable settings; broker access is behind a swappable interface; TURN only if the company-network test fails | Fixed in the PRD | PRD NFR-5, NFR-10, NFR-11 |
| AD-5 | State authority | Facilitator's browser is the authoritative host; participants send intents; the host applies them and sends state to everyone, withholding unrevealed entries | Fixed in the PRD | PRD FR-1.5, Q2 (cycle 1) |
| AD-6 | Local persistence | Browser localStorage, one versioned key per role, written on every change; Facilitator resumes only on the same browser and device | Fixed in the PRD | PRD Q3 (cycle 1), Q11 (cycle 2), NFR-9 |
| AD-7 | Identifiers | Random unguessable session ID kept in the Facilitator's local data; link carries it in the URL fragment; separate 6-character join code from an alphabet without look-alike characters, case-insensitive; random participant token per participant | Fixed in the PRD | PRD FR-1.2, FR-1.3, Q4 (cycle 1), Q14 (cycle 2) |
| AD-8 | Second tab behavior | First tab stays host; second tab is offered "take over", which makes the first tab read-only | Fixed in the PRD | PRD FR-1.13 |
| AD-9 | Test tooling | Vitest with @testing-library/preact and an in-memory transport for host and client logic; PeerJS used only in one adapter file | Reuses the Vite configuration; deterministic tests without WebRTC | Q1 (cycle 1), architecture advisor |
| AD-10 | UI state management | @preact/signals as the view layer; the host reducer stays plain TypeScript | Small, made for Preact, later epics add slices easily | Q2 (cycle 1), architecture advisor |
| AD-11 | Join code resolution | The host registers two broker IDs: a long one from the random session ID and a short one derived from the code that only answers a lookup with the session ID | The link keeps the unguessable ID; the code works without a server of ours; the code is only as secret as its 6 characters, so the host limits lookups and the Facilitator can remove unwanted people | Q3 (cycle 1), architecture advisor |
| AD-12 | Sync protocol | Full filtered snapshot on join/reconnect, then small updates that replace a whole item and carry a per-recipient sequence number; a gap triggers a new snapshot; messages carry a protocol version; every write carries a unique ID so re-sends never duplicate | Simple at 3-8 people and lets Epic 4 hide entries per recipient | Q4 (cycle 1), architecture advisor |
| AD-13 | Second tab detection | Web Locks for host ownership plus a BroadcastChannel message for the take-over request | Exact and crash-safe; no stale markers | Q5 (cycle 1), architecture advisor |
| AD-14 | E2E signaling | A local PeerJS signaling server (the `peer` package) started by Playwright's web server, with the app built to use it; plus a manual smoke test against the real broker | Deterministic, offline and CI-safe, still the real PeerJS/WebRTC path | Q6 (cycle 1), architecture advisor |
| AD-15 | Routing | A small own hash router that also removes the session ID from the address bar after joining; the active session is remembered per tab in sessionStorage | A handful of routes only; reload in the same tab still rejoins automatically | Q7 (cycle 1), architecture advisor |
| AD-16 | "Leave session" | Closes the session on the participant's device only; the participant stays in the Facilitator's list as offline and can rejoin with the same token later | Keeps entries; chosen in the answer to PRD gap Q8 | Q8 (cycle 1) |
| AD-17 | Expiry clock | 24 hours counted from the last time the local record was written (last activity), for Facilitator and participant records | A session in use is never removed | Q9 (cycle 1) |

## Technical Design

### Project structure
```
index.html
vite.config.ts                 base: relative ('./') so the site works under the GitHub Pages sub-path; Vitest config
playwright.config.ts           web servers: local signaling server + vite preview of the e2e build
.env.e2e                       broker and STUN values for the e2e build (local signaling server, no STUN)
src/
  main.tsx                     mounts <App/>, reads config, runs the expiry sweep
  config.ts                    broker host/port/path/key/secure, STUN list, timing constants (from Vite env with defaults)
  app/                         App.tsx, router.ts (hash router), ConnectionBanner, InternalNotice
  core/
    ids.ts                     session ID, join code, token, op ID generation + normalization
    types.ts                   SessionState, Participant, protocol message types
    reducer.ts                 host-side pure state changes
    view.ts                    viewFor(state, participantId): the single visibility filter
    registry.ts                extension points: intent handlers, view filters, end guards, removal hooks
  host/HostController.ts       owns state, applies intents, broadcasts, resolves codes, persists
  client/ClientController.ts   join/rejoin, offline outbox, presence, host-offline timer, sequence checking
  transport/
    Transport.ts               interface (listen/connect/send/close, events)
    PeerTransport.ts           the only file that imports PeerJS
    MemoryTransport.ts         in-memory implementation for tests
  storage/storage.ts           versioned localStorage wrapper, index, expiry sweep, session pointer (sessionStorage)
  tabs/TabGuard.ts             single-host protection and take-over
  ui/                          screens, components and store.ts (signals)
tests/ (unit)  e2e/ (Playwright: epic1-session-lifecycle.spec.ts, peer-server.mjs, manual/real-broker.spec.ts)
.github/workflows/deploy.yml   test + build + deploy to GitHub Pages
```

### Data model
All shared state is plain JSON-serializable data, so it can be sent, stored and filtered easily.

```ts
interface Participant {
  id: string;                  // stable participant ID (UUID), generated by the host
  name: string;                // as entered
  displayName: string;         // name with suffix if duplicate, e.g. "Sam (2)"
  role: string;                // free text, required
  isFacilitator: boolean;
  presence: 'online' | 'offline';
  status: 'active' | 'removed';
  joinedAt: number;            // ms since epoch
}

type SessionStatus = 'lobby' | 'running' | 'ended';

interface FormatRef {          // placeholder structure until Epic 2 provides the real one
  id: string; name: string;
  columns: { id: string; name: string; prompt?: string }[];
  checkInQuestion: string;
}

interface SessionState {
  schemaVersion: number;       // NFR-9
  rev: number;                 // host revision, increases with every accepted change
  sessionId: string;           // unguessable, from the Facilitator's local data
  joinCode: string;            // 6 characters, normalized upper case
  title?: string;              // optional (FR-1.1), used by Epic 5
  createdAt: number;
  status: SessionStatus;
  format: FormatRef;
  timeBudgetMin: 30 | 50 | 80;
  participants: Record<string, Participant>;
  extensions: Record<string, unknown>;   // slices owned by later epics (phase, entries, notes, ...)
}
```

A participant who leaves (AD-16) stays in `participants` as `active` with `presence: 'offline'`. There is no separate "left" status.

Local records (localStorage; every record has `schemaVersion` and `savedAt`, where `savedAt` is updated on every write and is the base of the 24-hour expiry):

| Key | Content | Written by |
|-----|---------|-----------|
| `retro.host.<sessionId>` | `{ state, tokens: { [token]: participantId }, removedTokens: string[], appliedOps: { [participantId]: string[] } }` | Facilitator's device, on every state change |
| `retro.participant.<sessionId>` | `{ token, participantId, name, role, lastState, lastSeq, outbox: Intent[], leftLocally: boolean }` | Participant's device, on every change |
| `retro.identity` | `{ name, role }` (pre-fill, FR-1.14) | Participant/Facilitator device when joining |
| `retro.index` | list of `{ sessionId, role: 'host' \| 'participant', savedAt }` used for resume/rejoin offers and the expiry sweep | Both |

In sessionStorage (per tab): `retro.activeSession` = the session ID the tab is in, so a reload in the same tab rejoins or resumes automatically although the address bar no longer contains the ID (AD-15). A record whose `schemaVersion` is unknown is not loaded and is offered for deletion (NFR-9).

### Broker IDs
The PeerJS broker allows letters, digits, hyphens and underscores. The app uses a fixed prefix `retro` to avoid collisions on the shared public broker:
- Session ID: `retro-s-<sessionId>` (the host and all participants' data connections use it)
- Resolver ID: `retro-c-<JOINCODE>` (answers lookups only)

### Modules and components

**`core/ids.ts`**
- `createSessionId()`: 128 random bits from `crypto.getRandomValues`, encoded URL-safe (letters/digits).
- `createJoinCode()`: 6 characters from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L); `normalizeJoinCode(input)` trims and upper-cases; typed look-alike characters (such as `0` or `O`) are not in the alphabet and are rejected as invalid.
- `createToken()`: 128 random bits; `createOpId()`: UUID.

**`core/reducer.ts`** (pure functions, `(state, intent, ctx) → { state, effects }`)
- `createSession({ name, role, title, format, timeBudgetMin })` → initial state in `lobby` with the Facilitator as first participant.
- `join({ name, role })`: validates both non-empty after trimming, assigns `id`, computes `displayName` (first free of `name`, `name (2)`, `name (3)`, …), no hard limit (the soft warning above 8 is derived in the UI).
- `rejoin(token)`: maps a known token to its participant and sets `presence: 'online'`; unknown or removed tokens are rejected.
- `setPresence(participantId, online|offline)`; `leave` from a participant is a presence change to `offline`.
- `start()`: only valid in `lobby` and only for the Facilitator → `running`.
- `remove(participantId)`: Facilitator-only (and not themselves); sets `status: 'removed'`, adds the token to `removedTokens`, and calls the registered removal hooks so later epics can drop that person's entries (PRD Journey 7).
- `end()`: Facilitator-only; `ended`; afterwards all intents except presence are rejected.
- Every accepted change increments `rev`.

**`core/registry.ts`** (the extension points for Epics 3-5)
- `registerIntentHandler(type, handler)`: later epics add their intents (e.g. `entry.add`); the host routes unknown types to the registry and rejects them if no handler exists. Registering a type twice throws.
- `registerViewFilter(filter)`: `(state, participantId) → state` applied inside `viewFor`; Epic 4 uses it to withhold unrevealed entries (AC-22).
- `registerEndGuard(guard)`: `(state) → { message?: string }`; the end-session flow asks every guard and shows the messages before ending (FR-1.10; Epic 4 registers "N entries are still hidden").
- `registerRemovalHook(hook)`.

**`core/view.ts`**: `viewFor(state, participantId)` is the **only** way state leaves the host. It removes `removed` participants, applies all view filters, and strips host-only fields. Every send path in `HostController` uses it (AC-22).

**`transport/Transport.ts`**
```ts
interface Connection {
  readonly remoteId: string;
  send(msg: unknown): void;
  close(): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
}
interface Transport {
  listen(id: string, onConnection: (c: Connection) => void): Promise<void>;   // host; may be called for several IDs
  connect(id: string): Promise<Connection>;                                    // participant
  stop(): void;
  onStatus(cb: (s: 'connecting' | 'online' | 'offline') => void): void;
}
```
`PeerTransport` implements this with PeerJS and reads broker host/port/path/key/secure and the STUN list from `config.ts` (AC-31). It supports several listening IDs by holding one PeerJS `Peer` per ID. `MemoryTransport` implements it with linked in-memory channels that can be told to drop, delay and reconnect.

**Protocol messages** (every message is `{ v: <protocolVersion>, type, ... }`; the host answers an unknown `v` with `rejected { reason: 'version' }` and the client shows "Please reload the page to update").
- Resolver connection: client → `lookup { code }`; host → `resolved { sessionId }` or `notFound`, then closes. The host allows one lookup per connection and at most 10 lookups per minute in total (further ones get `notFound` after a one-second delay).
- Client → host: `join { name, role }`, `rejoin { token }`, `intent { opId, type, payload }`, `leave {}`, `resync { haveSeq }`.
- Host → client: `welcome { token?, participantId, seq, state }` (full filtered snapshot), `update { seq, rev, changes: [{ path, value }] }` where `path` addresses a whole item (for example `['status']`, `['participants', id]`, `['extensions', 'entries', entryId]`) and `value: null` deletes it, `ack { opId, seq }`, `removed {}`, `ended {}`, `rejected { reason }`.
- `seq` is a per-recipient counter (each recipient receives consecutive values even when the view filter hides some changes from them); the client expects `seq` to be last + 1 and sends `resync` on a gap, which the host answers with a new `welcome`-style snapshot. `rev` is the host's state revision (used for persistence and display only).
- Every intent has a client-generated `opId`; the host remembers applied `opId`s per participant (`appliedOps`), so a re-sent intent is acknowledged again without being applied twice.

**`host/HostController.ts`**
- Created from a new session or from a persisted `retro.host.<sessionId>` record (resume).
- Listens on `retro-s-<sessionId>` and `retro-c-<JOINCODE>`. If the resolver ID is already taken when a session is created, a new code is generated (up to 5 attempts). If an ID is taken when resuming (the broker still holds the old registration after a crash), it retries with backoff and the UI shows "Waiting for the connection to be released".
- On a session connection: expects `join` or `rejoin`; validates; replies with `welcome`; then sends an `update` for the changed participant to everyone else.
- On `intent`: checks the sender's token, deduplicates by `opId`, routes to the reducer or the registry, persists, and sends per-recipient `update`s built from `viewFor`.
- On connection close: `setPresence(offline)`.
- Persists the local record after every change (at most once per animation frame, flushed on `pagehide`).
- Provides `stop()` for the take-over (releases listening IDs) and `setReadOnly()`.

**`client/ClientController.ts`**
- `join(codeOrId, name, role)` (resolves a code first through the resolver ID, then connects to the session ID) and `rejoin()` (from `retro.participant.<sessionId>`).
- Connection status: `connecting`, `online`, `reconnecting`, `facilitator-offline` (NFR-6). Reconnects with exponential backoff (1 s, 2 s, 4 s, 8 s, then 15 s) and never gives up on its own, unless the participant has used "Leave session" (`leftLocally`).
- Keeps the last received state and shows it when the Facilitator is offline.
- Outbox: intents created while offline are stored in `outbox` (and persisted); on reconnect they are re-sent in order with the same `opId`s; the host's `ack` removes them.
- After 15 minutes in `facilitator-offline` (a constant in `config.ts`), exposes `longOffline = true` so the UI shows the "copy your entries" hint and "Leave session" (FR-1.15).
- "Leave session": sets `leftLocally: true`, stops reconnecting, sends `leave` if connected, and returns to the home screen; the record stays so the participant can rejoin with the same token from the home screen (AD-16).
- Handles `removed` (clears the participant record and shows the message), `ended`, `rejected` (unknown session, invalid token, version).

**`storage/storage.ts`**: typed getters/setters over localStorage and sessionStorage, wrapped in try/catch (private mode can throw; the app then keeps working without resume and shows a note), versioning, `retro.index`, `sweepExpired(now)` (removes records whose `savedAt` is older than 24 hours), `removeSession(sessionId)` for Epic 5 (FR-1.9), and the `retro.activeSession` pointer.

**`tabs/TabGuard.ts`**: `acquireHost(sessionId) → 'acquired' | 'taken'` uses `navigator.locks.request('retro-host-' + sessionId, { ifAvailable: true }, …)` and holds the lock for the life of the tab; `requestTakeOver(sessionId)` posts `takeover-request` on a `BroadcastChannel('retro-host-' + sessionId)`; the current host tab stops its `HostController`, releases the lock, becomes read-only and replies `released`; the requester then waits for the lock and starts hosting; `onTakenOver(cb)` notifies the first tab. Web Locks support is required (NFR-2, modern browsers).

**`app/router.ts`**: parses `#/`, `#/create`, `#/join/<sessionId>`, `#/lobby`, `#/session`, `#/ended`; after a successful join or resume it removes the session ID from the address bar with `history.replaceState` and keeps the session in `retro.activeSession` (sessionStorage).

**UI (`src/ui`)**: `HomePage` (create, join with code, "Resume session" for host records, "Rejoin session" for participant records), `CreateSessionPage` (name, role, optional title, placeholder format/time budget until Epic 2), `JoinPage` (name, role, pre-fill, "forget me"), `LobbyPage` (participants, presence, Start for the Facilitator, soft warning above 8, remove action), `SessionShell` (holds the area where Epics 3-4 render phases; shows connection banner and participant list), `EndedPage` (placeholder for Epic 5's documentation screen with the leave hook), `ConnectionBanner`, `InternalNotice` (footer on every screen), `TakeOverDialog`. State from the controllers reaches the screens through signals in `ui/store.ts`. All screens are mobile-first; accessible labels and roles are used so e2e tests can select by role; all English texts are in one `texts.ts`.

### Interfaces (summary)
Transport (above), Protocol messages (above), Storage records (data model), Registries (modules), and `config.ts`:
```ts
interface AppConfig {
  broker: { host: string; port: number; path: string; key: string; secure: boolean };
  stunUrls: string[];
  hostOfflineHintMs: number;     // 15 min
  expiryMs: number;              // 24 h
  maxLookupsPerMinute: number;   // 10
}
```
Values come from `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_KEY`, `VITE_PEER_SECURE`, `VITE_STUN_URLS` with defaults for the public PeerJS broker and a public STUN server.

### Key flows

**Journey 1: Facilitator creates a session.** `CreateSessionPage` validates name and role (non-empty) → `createSession` → `TabGuard.acquireHost` → `HostController` starts listening on both IDs → persist `retro.host.<id>`, `retro.index`, `retro.identity`, `retro.activeSession` → lobby shows the link `<origin><base>#/join/<sessionId>` and the code, each with a copy button (Clipboard API with a visible-text fallback), and the Facilitator marked as Facilitator.

**Journey 2: Participant joins.** The link (`#/join/<id>`) or the code entry opens `JoinPage`. With a code, the client connects to `retro-c-<CODE>`, sends `lookup`, receives `resolved { sessionId }`, then connects to `retro-s-<sessionId>`. Name and role are pre-filled from `retro.identity` with a "forget me" link that deletes it. Submit → `join` → `welcome` with a new token (stored in `retro.participant.<sessionId>`) → lobby; the address bar is cleaned. Errors: unknown/ended session or invalid code (`notFound`, connection failure) → "session cannot be found" (AC-4); empty fields → inline messages (AC-5). Duplicate names get suffixes (AC-20).

**Journey 3: Start.** Facilitator presses Start → `start` → `running`; every participant's `update` moves them out of the lobby. A non-Facilitator's `start` is rejected (AC-7). More than 8 participants show a soft warning to the Facilitator only (AC-21). There is no minimum number of participants (assumption).

**Journey 4: Late join.** Same as join; the `welcome` carries the current `viewFor` state, so the participant lands in the running session (AC-9).

**Journey 5: Reconnect/reload.** On load (or after a connection drop) the client finds `retro.participant.<id>` (from `retro.activeSession` in the same tab, or from the "Rejoin session" list in a new tab) → shows `reconnecting` → `rejoin(token)` → host maps token to participant, sets online, sends a snapshot; the outbox is re-sent (AC-10, AC-11).

**Journey 6: Facilitator closes and resumes.** On load, `HomePage` finds `retro.host.*` records (and the same-tab pointer) and offers "Resume session". Resume → `TabGuard.acquireHost` → `HostController` from the record → listens on the same IDs (retrying with backoff while the broker still holds the old registration) → participants' reconnect loops succeed → outboxes are re-sent and deduplicated. A different browser or device has no record, so no resume is offered (AC-25). If `acquireHost` reports `taken`, `TakeOverDialog` offers "take over"; on confirm the first tab stops hosting and goes read-only, and the second tab acquires and starts (AC-24). While the host is gone, clients show `facilitator-offline`, keep the last state and continue to accept local writes; after 15 minutes the hint and "Leave session" appear (AC-13, AC-28).

**Journey 7: Remove.** Facilitator → remove → confirm → `remove` → the removed client gets `removed`, is disconnected, clears its participant record and shows the message; the token is in `removedTokens`, so a `rejoin` is rejected; the participant disappears from the list (AC-29, AC-30). A removed person who joins again through the link with a new `join` is a new participant, and the Facilitator can remove them again.

**Journey 8: End.** Facilitator → "End session" → end guards run; their messages are shown in the confirmation dialog (FR-1.10; Epic 4's hidden-entries warning) → `end` → state `ended`; every client gets the final update and `ended`; no further intents are accepted; screens switch to `EndedPage`, where Epic 5 provides the documentation. Local data for the session is removed by `storage.removeSession` only when Epic 5 reports that the person has left the documentation screen (AC-14); `sweepExpired` removes records not written for 24 hours at every app start (AC-23).

**Network and privacy (AC-17).** Besides the page's own origin, the app contacts only the configured broker and STUN servers. A unit test and an e2e test assert this.

## Implementation Tasks

Tasks are ordered; tasks with the same dependencies can run in parallel (T-2, T-3, T-5, T-6 after T-1; T-4 after T-3; T-7 after T-6; T-8 after T-3 to T-7; T-9 after T-8; T-10 after T-5; T-11 and T-12 after T-8 to T-10).

### T-1: Project scaffold, tooling and deployment
- **Satisfies:** NFR-2, NFR-8 (AC-16 base)
- **Depends on:** none
- **Tests first (TDD):**
  - `tests/smoke.test.tsx`: the app module renders `<App/>` without throwing and shows the internal-use notice text.
  - `tests/config.test.ts`: `config.ts` returns defaults, overrides from Vite env values, and rejects an invalid timing value.
- **Implementation:** Create the Vite + TypeScript + Preact project (strict TypeScript), the Vitest setup with @testing-library/preact and a DOM environment, lint and format config, `vite.config.ts` with a relative base, `src/config.ts`, `.github/workflows/deploy.yml` (install, test, build, deploy to GitHub Pages). Add npm scripts: `dev`, `build`, `build:e2e`, `preview`, `test`, `test:e2e`.
- **Done when:** `npm test` and `npm run build` pass; the workflow file is valid; the built site works from a sub-path.

### T-2: Identifiers and join code
- **Satisfies:** FR-1.2, FR-1.3 (token), AC-2, AC-26
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/ids.test.ts`: `createSessionId` returns URL-safe strings of at least 22 characters and is different on repeated calls; `createJoinCode` returns exactly 6 characters, only from the alphabet (run 1,000 times, never `0 O 1 I L`); `normalizeJoinCode(' k7m4qx ')` → `K7M4QX`; codes containing look-alike characters are invalid; `createToken` and `createOpId` are unique over 1,000 calls.
- **Implementation:** `core/ids.ts` using `crypto.getRandomValues`.
- **Done when:** tests pass.

### T-3: Session state and reducer
- **Satisfies:** FR-1.1, FR-1.3, FR-1.4, FR-1.10, FR-1.16; AC-1, AC-3, AC-5, AC-6, AC-7, AC-11, AC-15, AC-20, AC-21, AC-29, AC-30
- **Depends on:** T-1, T-2
- **Tests first (TDD):**
  - `tests/reducer.create.test.ts`: `createSession` makes the creator Facilitator, online, status `lobby`, with optional title and the given format and time budget.
  - `tests/reducer.join.test.ts`: join with valid name/role adds an active participant; empty or whitespace-only name or role is rejected; duplicate names become `Sam`, `Sam (2)`, `Sam (3)`; joining is allowed when 9+ participants exist; joining an `ended` session is rejected.
  - `tests/reducer.rejoin.test.ts`: known token → same participant, online, no duplicate; unknown token rejected; removed token rejected.
  - `tests/reducer.presence.test.ts`: `setPresence` toggles online/offline without creating participants; a `leave` only sets the participant offline and keeps them in the list.
  - `tests/reducer.start.test.ts`: Facilitator can start from `lobby`; non-Facilitator is rejected; starting twice is a no-op.
  - `tests/reducer.remove.test.ts`: only the Facilitator can remove; removed participant's status is `removed`; token is added to `removedTokens`; removal hooks are called; the Facilitator cannot remove themself.
  - `tests/reducer.end.test.ts`: only the Facilitator can end; after `ended` all intents except presence are rejected.
  - `tests/reducer.rev.test.ts`: every accepted change increments `rev`; rejected intents do not.
- **Implementation:** `core/types.ts`, `core/reducer.ts` as described.
- **Done when:** all reducer tests pass.

### T-4: Visibility filter and extension registry
- **Satisfies:** FR-1.5; AC-8 (host processes first), AC-22
- **Depends on:** T-3
- **Tests first (TDD):**
  - `tests/view.test.ts`: `viewFor` omits `removed` participants; applies registered view filters in order; a test filter that removes other participants' items from `extensions.entries` means participant B's view lacks participant A's unrevealed item, while A's own view keeps it; the returned object shares no references that could leak hidden data.
  - `tests/registry.test.ts`: unknown intent types are rejected; a registered handler is called with the sender's participant ID; registering the same type twice throws; end guards are collected and their messages returned; removal hooks are called.
- **Implementation:** `core/view.ts`, `core/registry.ts`.
- **Done when:** tests pass.

### T-5: Storage, versioning, expiry and remembered identity
- **Satisfies:** FR-1.8, FR-1.9, FR-1.14, NFR-9; AC-10 (token persistence), AC-12, AC-14, AC-23, AC-25, AC-27
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/storage.test.ts`: write/read round trip of host and participant records; a record with an unknown `schemaVersion` is not loaded and is listed for deletion; `removeSession` deletes the record and the index entry; `sweepExpired` with fake timers removes records whose `savedAt` is older than 24 hours and keeps newer ones, and a record that is written again resets its clock; reads and writes survive a throwing `localStorage` (private mode) by returning "unavailable" and not crashing; `saveIdentity`/`forgetIdentity` store and clear name and role; the `retro.activeSession` pointer lives in sessionStorage; a host record from another browser is simply not there (no resume offered).
- **Implementation:** `storage/storage.ts`.
- **Done when:** tests pass.

### T-6: Transport interface and in-memory transport
- **Satisfies:** AC-6, AC-8, AC-18 (test infrastructure); NFR-6
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/memoryTransport.test.ts`: a host `listen` and a client `connect` exchange messages in order; the host can listen on two IDs; `drop()` triggers `onClose` on both sides; after `drop()` a new `connect` works; connecting to an unknown ID fails; delay can be controlled by the test; `onStatus` reports `online` after `listen`.
- **Implementation:** `transport/Transport.ts`, `transport/MemoryTransport.ts`.
- **Done when:** tests pass.

### T-7: PeerJS transport and configuration
- **Satisfies:** NFR-1, NFR-10, NFR-11; AC-17, AC-31
- **Depends on:** T-6
- **Tests first (TDD):**
  - `tests/peerTransport.config.test.ts`: with a mocked `peerjs` module, `PeerTransport` passes the broker host/port/path/key/secure and STUN list from `config.ts` to the `Peer` constructor; changing the config changes the arguments with no other code change; listening on two IDs creates two peers; no other module imports `peerjs` (a source-scanning test).
  - `tests/network.privacy.test.ts`: with `fetch` and `XMLHttpRequest` spies, running a complete memory-transport session produces no network calls.
- **Implementation:** `transport/PeerTransport.ts` (the only file importing `peerjs`) with the configuration values listed above. Maps PeerJS events to the `Transport` interface, including `disconnected` → `offline` and automatic `reconnect()`.
- **Done when:** tests pass and the transport can be pointed to another broker by configuration only.

### T-8: Host controller, sync protocol and code resolution
- **Satisfies:** FR-1.2, FR-1.5, FR-1.6, FR-1.8; AC-1, AC-2, AC-6, AC-8, AC-9, AC-12, AC-18, AC-22
- **Depends on:** T-3, T-4, T-5, T-6
- **Tests first (TDD):**
  - `tests/host.join.test.ts`: with memory transport, three clients join; each gets a `welcome` with its own token; the lobby list updates on all clients; every state sent comes from `viewFor` (a spy asserts no raw state is sent).
  - `tests/host.intents.test.ts`: an intent with a valid token is applied once; the same `opId` sent twice is applied once and acknowledged twice; an intent with an unknown or removed token is rejected; an intent from a connection that did not `join`/`rejoin` is rejected; an unknown protocol version gets `rejected { reason: 'version' }`.
  - `tests/host.sync.test.ts`: each recipient receives consecutive `seq` values even when a view filter hides some changes from them; a client that reports a gap with `resync` receives a new snapshot; updates carry whole-item changes and `value: null` deletes.
  - `tests/host.resolver.test.ts`: a lookup with the correct code returns the session ID; a lookup with a wrong code never reaches the host (no listener) and the client gets `notFound`; the host answers at most one lookup per connection and at most 10 per minute (further ones get `notFound` after a one-second delay); a code collision at creation regenerates the code.
  - `tests/host.persist.test.ts`: after each accepted change a host record exists; creating a new `HostController` from that record restores participants, tokens, `rev` and `appliedOps`; clients that reconnect are matched by token (resume); a taken ID at resume is retried with backoff and reports "waiting".
  - `tests/host.late.test.ts`: a client joining a `running` session receives the current state in its `welcome`.
  - `tests/host.scale.test.ts`: 8 memory clients join and one makes 100 intents; all clients converge to the same state within the test's fake-time budget.
- **Implementation:** `host/HostController.ts` as described, including the resolver listener and rate limit.
- **Done when:** tests pass.

### T-9: Client controller
- **Satisfies:** FR-1.3, FR-1.6, FR-1.7, FR-1.12, FR-1.15; NFR-6; AC-3, AC-4, AC-9, AC-10, AC-11, AC-13, AC-28
- **Depends on:** T-8
- **Tests first (TDD):**
  - `tests/client.join.test.ts`: `join` with a valid session ID gets `welcome` and stores the participant record; `join` with a code resolves it first and then connects; an unknown code yields `session not found`; `rejected` with reason `version` yields an update message.
  - `tests/client.rejoin.test.ts`: after `drop()`, the client shows `reconnecting`, then rejoins with its token without creating a duplicate participant and without losing its entries.
  - `tests/client.sync.test.ts`: an update with a gap in `seq` triggers `resync`; updates apply by replacing whole items; a duplicate `seq` is ignored.
  - `tests/client.offline.test.ts`: when the host stops, status becomes `facilitator-offline`, the last state stays visible, intents created meanwhile are stored in the outbox (and persisted); after the host resumes, the outbox is re-sent once and cleared on `ack`; re-sending after a second drop causes no duplicates.
  - `tests/client.longOffline.test.ts`: with fake timers, `longOffline` becomes true after exactly 15 minutes offline and false again after the host returns; the participant record and entries are kept.
  - `tests/client.leave.test.ts`: "Leave session" stops reconnecting, sets `leftLocally`, keeps the record, and a later rejoin with the same token succeeds and the participant appears online again.
  - `tests/client.removed.test.ts`: `removed` clears the participant record and exposes the removal message; a later `rejoin` is rejected.
  - `tests/client.backoff.test.ts`: reconnect delays follow 1, 2, 4, 8, 15, 15 seconds.
- **Implementation:** `client/ClientController.ts`.
- **Done when:** tests pass.

### T-10: Tab guard (single host) and take-over
- **Satisfies:** FR-1.13; AC-24
- **Depends on:** T-5
- **Tests first (TDD):**
  - `tests/tabGuard.test.ts`: with a fake lock manager and a fake broadcast channel, the first `acquireHost(sessionId)` returns `acquired`, the second returns `taken`; `requestTakeOver` makes the first guard call `onTakenOver`, stop hosting and release the lock; afterwards the second can acquire; a released/crashed first tab (lock released) lets the next call acquire immediately; a reload of the only tab re-acquires cleanly.
- **Implementation:** `tabs/TabGuard.ts` using the Web Locks API and a BroadcastChannel as described.
- **Done when:** tests pass.

### T-11: Screens: home, create, join, lobby, router, notices
- **Satisfies:** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.11, FR-1.14, NFR-3, NFR-6, NFR-7; AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-16, AC-19, AC-21, AC-26, AC-27
- **Depends on:** T-8, T-9, T-10
- **Tests first (TDD):**
  - `tests/router.test.ts`: `#/join/<id>` is parsed; after joining the fragment is removed from the address bar and `retro.activeSession` is set; a reload in the same tab (pointer present) rejoins; a new tab with no pointer shows the home screen with "Rejoin session" for existing participant records.
  - `tests/ui.home.test.tsx`: shows create and join; shows "Resume session" only when a host record exists and "Rejoin session" when participant records exist; shows the internal-use notice.
  - `tests/ui.create.test.tsx`: submit is blocked with messages when name or role is empty; the optional title is accepted; on success the lobby shows the link, the 6-character code and copy buttons, and the Facilitator marked as Facilitator.
  - `tests/ui.join.test.tsx`: name and role are pre-filled from the remembered identity; "forget me" clears them; empty fields block joining; an invalid or unknown code shows "session cannot be found".
  - `tests/ui.lobby.test.tsx`: shows participants with role and online/offline; the Start button is present only for the Facilitator; with 9 participants the Facilitator sees the soft warning and nobody is refused; duplicates show the suffix.
  - `tests/ui.banner.test.tsx`: the connection banner shows `connecting`, `reconnecting` and `Facilitator offline`; the 15-minute hint and "Leave session" appear when `longOffline` is true.
  - `tests/ui.notice.test.tsx`: the internal-use notice is on every route.
- **Implementation:** the screens and components listed above, `app/router.ts`, `ui/store.ts` (signals), `texts.ts`, responsive layout with large touch targets.
- **Done when:** tests pass; the screens work at 360 px width.

### T-12: End session, remove participant, leave, cleanup
- **Satisfies:** FR-1.9, FR-1.10, FR-1.15, FR-1.16; AC-14, AC-15, AC-23, AC-28, AC-29, AC-30
- **Depends on:** T-8, T-9, T-11
- **Tests first (TDD):**
  - `tests/ui.end.test.tsx`: "End session" asks for confirmation; with a registered end guard that returns a message, the dialog shows it; after confirming, all clients see the ended screen and further intents are rejected.
  - `tests/ui.remove.test.tsx`: the remove action exists only for the Facilitator; after confirming, the participant is gone from all lists and sees the removal message.
  - `tests/ui.leave.test.tsx`: "Leave session" returns to the home screen, the participant shows as offline for the Facilitator, and the home screen offers "Rejoin session" for it.
  - `tests/cleanup.test.ts`: `removeSession` is called when the ended screen reports "left documentation screen" and not after other events; the 24-hour sweep runs at app start and removes records not written for 24 hours.
- **Implementation:** end/remove/leave flows, `EndedPage` placeholder with a clearly named `onLeaveDocumentation` hook for Epic 5, the sweep at start.
- **Done when:** tests pass.

### T-13: Deployment verification and README
- **Satisfies:** NFR-8
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/build.test.ts`: the built `index.html` references assets with relative paths; the join link generator produces `<origin><base>#/join/<id>` for a sub-path base.
- **Implementation:** README with setup, scripts, configuration of broker and STUN, deployment steps (enable GitHub Pages with the Actions source).
- **Done when:** the workflow deploys a working site to a test repository.

### T-14: Company-network spike (manual, not a feature)
- **Satisfies:** NFR-5
- **Depends on:** T-7
- **Tests first (TDD):** Not applicable (manual check). A written checklist `docs/network-check.md` and the manual test `e2e/manual/real-broker.spec.ts` (excluded from CI) are the deliverables.
- **Implementation:** A checklist for the check described in the PRD's "Flag for later" (two company laptops on the office network, host and join, reload-rejoin), the outcomes and the questions to ask IT depending on the result; the manual test runs the create-and-join flow against the real public broker.
- **Done when:** the checklist and the manual test exist; the result of running them is recorded by the team (not by the build).

## Traceability
| AC | Tasks | Tests |
|----|-------|-------|
| AC-1 | T-3, T-8, T-11 | reducer.create, host.join, ui.create, e2e J1 |
| AC-2 | T-2, T-8, T-11 | ids, host.resolver, ui.create, e2e J1 |
| AC-3 | T-3, T-9, T-11 | reducer.join, client.join, ui.join, e2e J2 |
| AC-4 | T-9, T-11 | client.join, ui.join, e2e J2 |
| AC-5 | T-3, T-11 | reducer.join, ui.join, e2e J1 |
| AC-6 | T-3, T-6, T-8, T-11 | reducer.presence, host.join, ui.lobby, e2e J2 |
| AC-7 | T-3, T-11 | reducer.start, ui.lobby, e2e J3 |
| AC-8 | T-4, T-8 | view, host.intents, host.sync, host.scale |
| AC-9 | T-8, T-9 | host.late, client.join, e2e J4 |
| AC-10 | T-5, T-9, T-11 | storage, client.rejoin, router, e2e J5 |
| AC-11 | T-3, T-9 | reducer.presence, client.rejoin, e2e J5 |
| AC-12 | T-5, T-8 | host.persist, e2e J6 |
| AC-13 | T-9 | client.offline, e2e J6 |
| AC-14 | T-5, T-12 | storage, cleanup, e2e J8 |
| AC-15 | T-3, T-12 | reducer.end, ui.end, e2e J8 |
| AC-16 | T-1, T-11 | smoke, ui.home, ui.notice, e2e J1 |
| AC-17 | T-7 | network.privacy, e2e Privacy |
| AC-18 | T-8 | host.scale |
| AC-19 | T-11 | ui tests at 360 px, e2e J2 (mobile viewport) |
| AC-20 | T-3 | reducer.join, e2e J2 |
| AC-21 | T-3, T-11 | reducer.join, ui.lobby |
| AC-22 | T-4, T-8 | view, host.join |
| AC-23 | T-5, T-12 | storage, cleanup |
| AC-24 | T-10 | tabGuard, e2e J6 |
| AC-25 | T-5 | storage, e2e J6 |
| AC-26 | T-2, T-11 | ids, ui.create, e2e J1 |
| AC-27 | T-5, T-11 | storage, ui.join, e2e J2 |
| AC-28 | T-9, T-11, T-12 | client.longOffline, ui.banner, ui.leave, e2e J6 |
| AC-29 | T-3, T-9, T-12 | reducer.remove, client.removed, ui.remove, e2e J7 |
| AC-30 | T-3, T-12 | reducer.remove, ui.remove, e2e J7 |
| AC-31 | T-7 | peerTransport.config |

| FR / NFR | Tasks |
|----------|-------|
| FR-1.1 | T-3, T-11 |
| FR-1.2 | T-2, T-8, T-11 |
| FR-1.3 | T-2, T-3, T-9, T-11 |
| FR-1.4 | T-3, T-11 |
| FR-1.5 | T-4, T-8 |
| FR-1.6 | T-8, T-9 |
| FR-1.7 | T-9 |
| FR-1.8 | T-5, T-8, T-10 |
| FR-1.9 | T-5, T-12 |
| FR-1.10 | T-3, T-12 |
| FR-1.11 | T-11 |
| FR-1.12 | T-9 |
| FR-1.13 | T-10 |
| FR-1.14 | T-5, T-11 |
| FR-1.15 | T-9, T-11, T-12 |
| FR-1.16 | T-3, T-12 |
| NFR-1 | T-7 |
| NFR-2 | T-1, T-10 |
| NFR-3 | T-11 |
| NFR-4 | T-8 |
| NFR-5 | T-14 |
| NFR-6 | T-6, T-9, T-11 |
| NFR-7 | T-11 |
| NFR-8 | T-1, T-13 |
| NFR-9 | T-5 |
| NFR-10 | T-7 |
| NFR-11 | T-7 |

## E2E Test (Playwright)
The implement-epic skill builds and sets up this test later; this spec only describes it.

**File:** `e2e/epic1-session-lifecycle.spec.ts`. One test per PRD journey, plus a privacy check. Multiple participants are simulated with several Playwright browser contexts in one test (the Facilitator in context F, participants in A and B), each with its own localStorage.

**How the app starts:** `playwright.config.ts` defines two `webServer` entries: (1) `e2e/peer-server.mjs`, a small local signaling server built with the `peer` package on `localhost:9000`, and (2) `npm run build:e2e && vite preview`, serving a production build made with `.env.e2e` (`VITE_PEER_HOST=localhost`, `VITE_PEER_PORT=9000`, `VITE_PEER_SECURE=false`, no STUN servers). No traffic leaves the machine, and no real broker or STUN server is used. Loopback WebRTC connections between contexts work without TURN.

**Fixtures:** helper `createSession(page, {name, role, title?})` returns `{ link, code }`; helper `join(page, {linkOrCode, name, role})`. No seeded data is needed. Time-dependent tests use Playwright's clock control (`page.clock`).

**Tests:**
1. **J1 Create** — F opens `/`, sees the internal-use notice (`getByText`), clicks "Create session" (`getByRole('button')`), leaves name empty and submits → sees an error; fills name, role, optional title → lobby shows a link containing `#/join/`, a 6-character code from the allowed alphabet, and "Facilitator" next to the name. Verifies AC-1, AC-2, AC-5, AC-16, AC-26.
2. **J2 Join** — A opens the link, sees the join form; fills name and role → lobby lists F and A; F's lobby shows A without reload; the address bar of A no longer contains the session ID. B enters the code on the home page and joins with the same name as A → list shows "Name" and "Name (2)". An invalid code (`ZZZZZZ`) shows "session cannot be found". B is run at a 390 × 844 viewport. After joining, a new context shows name and role pre-filled and "forget me" clears them. Verifies AC-3, AC-4, AC-6, AC-19, AC-20, AC-27.
3. **J3 Start** — only F has a "Start" button; clicking it moves F, A and B to the session screen. Verifies AC-7.
4. **J4 Late join** — after start, a new context C joins with the link and lands in the session screen. Verifies AC-9.
5. **J5 Reload** — A reloads the page in the same tab; the banner shows "reconnecting" and then A is back in the session as the same person, with no duplicate in F's list. Verifies AC-10, AC-11.
6. **J6 Host resume and second tab** — F reloads: the home screen offers "Resume session"; resuming restores the session and the same join link works for a new context. While F is closed, A shows "Facilitator offline"; advancing the clock by 15 minutes shows the "copy your entries" hint and "Leave session". A new browser context (no local data) opened at `/` shows no resume option (AC-25). F opens a second tab in the same context: it offers "take over"; after confirming, the first tab is read-only. Verifies AC-12, AC-13, AC-24, AC-25, AC-28.
7. **J7 Remove** — F clicks "Remove" next to B and confirms; B sees the removal message; F's and A's lists no longer show B; B reloading and trying to rejoin is rejected. Verifies AC-29, AC-30.
8. **J8 End** — F clicks "End session" and confirms; A and B see the ended screen and can no longer change anything; after the ended screen's leave action, the participant's localStorage record is gone (checked with `page.evaluate`). Verifies AC-14, AC-15.
9. **Privacy** — for a full run of J1-J3, all requests recorded with `page.on('request')` go only to the app's own origin and the local signaling server. Verifies AC-17.

**Not covered by e2e (unit tests cover them):** AC-8, AC-18, AC-21, AC-22, AC-23, AC-31.

**Stubbed:** the public PeerJS broker and public STUN servers (replaced by the local signaling server).

**Manual smoke test, not in CI:** `e2e/manual/real-broker.spec.ts` runs the create-and-join flow once against the real public broker from the company network (see T-14).

## Decision Log
### Cycle 1
- Q: Which test tooling should be used, and how are host and client logic tested without real connections? → A: Vitest with @testing-library/preact and an in-memory transport for host and client logic
- Q: How should the UI hold the shared session state? → A: @preact/signals, with the host reducer kept as plain TypeScript
- Q: How is a 6-character join code turned into a connection to the Facilitator, with no backend of ours? → A: The host registers two IDs on the PeerJS broker: a long random session ID and a short ID derived from the code that only answers a lookup with the long ID
- Q: How do host and participants exchange state (the sync protocol)? → A: A full filtered snapshot on join/reconnect, then small updates that replace a whole item and carry a running number; a gap triggers a new snapshot; versioned messages; unique write IDs so re-sends never duplicate (design detail: the running number is per recipient, because filtered changes would otherwise look like gaps)
- Q: How is the Facilitator's second tab or window detected? → A: The browser's Web Locks feature for host ownership plus a broadcast message for the take-over request
- Q: How do the Playwright end-to-end tests handle signaling? → A: A local PeerJS signaling server started by Playwright together with the app, which is built to use it; plus a manual smoke test against the real broker
- Q: How is hash-based routing done? → A: A small own router, which also clears the session ID from the address bar after joining (design detail: the active session is kept per tab in sessionStorage so a reload still rejoins)
- Q: What does "Leave session" do when a participant uses it after the Facilitator has been offline for 15 minutes? → A: They only close the session on their device but stay in the Facilitator's list as offline, and can rejoin with the same token later (chosen instead of the recommended removal of local data)
- Q: From which moment do the 24 hours for automatic removal of local data count? → A: From the last time the record was written (last activity), for both Facilitator and participant records

## Open Questions

None — confidence reached 90%.
