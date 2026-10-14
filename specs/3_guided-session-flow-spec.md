# Spec: Epic 3 — Guided Session Flow

Confidence: 93%

PRD: [3_guided-session-flow.md](3_guided-session-flow.md)

## Overview
This spec turns the Epic 3 PRD into an implementable design. It covers:

- The fixed phases and the three retro steps, as one ordered list of eight "stops"
- The flow state (current stop, timers, reveal flags, mute-for-all) as an extension slice of the Epic 1 session state, and the Facilitator-only intents that change it
- Timers: pure functions, how devices agree on the remaining time, the "time is over" signal and sound, mute controls
- The suggested time per stop, taken from the chosen format's time split (Epic 2)
- Facilitation instructions as a data file
- The screens: flow shell, phase panel (Facilitator and participant views), timer, progress overview, review-of-previous-actions panel, Facilitator guide, contribution counter
- Extension points for Epic 4 (phase content, contribution counters, reveal flags)

**Design principle:** as in the Epic 1 and Epic 2 specs, the rules are plain TypeScript functions (navigation, timers, permissions, reveal, progress). The UI only renders the flow state. Everything the flow needs from other epics is reached through small registries and interfaces.

**Dependencies on other epics' specs:**
- **Epic 1 (spec):** session state and extensions slice (`extensions.flow`), intent handler and view-filter registries, `SessionShell` (renders the flow when the session is `running`), connection status (`facilitator-offline`), the message envelope (extended with the host's time, AD-12), `viewFor`.
- **Epic 2 (spec):** `Format.timeSplits[timeBudgetMin]`, `Format.facilitationTips`, `PHASES`, `RETRO_STEPS`, the Zod-based data validation approach.
- **Epic 4 (later spec):** supplies the content area of each stop, the "added something" counters and the hidden entries; this epic provides the reveal flags and the registries they plug into.

## Key Architecture Decisions
| # | Decision | Choice | Rationale | Source |
|---|----------|--------|-----------|--------|
| AD-1 | Stack, tests, UI state, routing, data validation | TypeScript, Vite, Preact, Vitest with @testing-library/preact, @preact/signals, own hash router, Zod for data files | Fixed by earlier decisions | Epic 1 spec AD-1, AD-9, AD-10, AD-15; Epic 2 spec AD-8 |
| AD-2 | Where flow state lives | An extension slice `extensions.flow` of the host-authoritative session state; only the Facilitator's intents change it; it is persisted and restored with the host record | Fixed by the PRD and Epic 1 | PRD FR-3.9; Epic 1 spec AD-5 |
| AD-3 | Timer representation | The host stores each timer as status, start time (host clock) and remaining time; each device calculates the remaining time itself; only start, pause and reset are sent; no per-second traffic | Fixed in the PRD | PRD Q1 (cycle 1), NFR-2 |
| AD-4 | Timers are advisory | A timer never blocks work and never changes the phase or step | Fixed in the PRD | PRD FR-3.4 |
| AD-5 | Navigation | The Facilitator moves freely forward and back between all stops, and by selecting a stop in the progress list; earlier content stays and stays editable; a running timer is paused when the Facilitator leaves its stop; no timer starts on its own | Fixed in the PRD | PRD Q3 (cycle 1), Q11 (cycle 2), FR-3.2, FR-3.12 |
| AD-6 | Retro steps | Retro has three steps (write silently, reveal, discuss), each with its own instruction and timer and a suggested time from the format's split | Fixed in the PRD | PRD Q4, Q10 (cycle 1, 2), FR-3.8 |
| AD-7 | Reveal | One reveal action shows all entries of the current phase (check-in or retro) at once; it is not reversible; entries added afterwards are visible immediately | Fixed in the PRD | PRD Q5, Q12, FR-3.7, FR-3.13 |
| AD-8 | Instructions | Facilitator sees the full instruction and the format's tips; participants see a one-line "what we are doing now"; texts are in one data file `phases.json` (id, title, one-line text, instruction, default time share) checked against a schema | Fixed in the PRD | PRD Q7, NFR-5 |
| AD-9 | Contribution counter | The Facilitator sees "N of M have added something" without names or content, only during write steps | Fixed in the PRD | PRD Q8, FR-3.10 |
| AD-10 | Sound | A short sound on every device at zero; every participant can mute on their own device (default on); the Facilitator can mute for everybody; the visual "time is over" signal is always shown | Fixed in the PRD | PRD Q6, Q9, FR-3.4 |
| AD-11 | Facilitator role | No reassignment in v1; the limitation is documented in the Facilitator guide | Fixed in the PRD | PRD Q2 (cycle 1), FR-3.11 |
| AD-12 | Clock agreement between devices | The host adds its current time (`hostTime`) to every host-to-client message; each device keeps an estimate of the difference to its own clock, using the smallest observed difference over a window of recent messages so that network delay does not skew it. This adds one field to the Epic 1 message envelope | No extra message types or timers; keeps the stored timer state stable and per-recipient updates clean; error of at most a few hundred milliseconds is fine for advisory timers | Q1 (cycle 1), architecture advisor |
| AD-13 | Alert sound | A short beep generated with the Web Audio feature (no audio file); the audio context is created or resumed on the first click or tap (joining or creating counts), before each beep, and when the tab becomes visible again; the visual "time is over" banner is always shown | No asset to ship; works on desktop and mobile once unlocked; a blocked sound never hides the alert | Q2 (cycle 1), architecture advisor |
| AD-14 | Timer display while the Facilitator is offline | The timer keeps counting down from the last known host-time estimate and is labeled "Not synchronized"; when the Facilitator is back, the display is corrected from the host's state | People can still see roughly how long is left; the label says that it may differ from the Facilitator's screen (chosen instead of the recommended freeze) | Q3 (cycle 1) |
| AD-15 | Timer display after zero | "Time is over" with the overtime counting up (for example "+02:15") until the Facilitator resets the timer or moves on | Shows how far past the plan the group is | Q4 (cycle 1) |
| AD-16 | "Next" into the retro reveal step | Moving into `retro.reveal` or `retro.discuss` (by Next or by selecting a stop) also reveals the retro entries, and the Facilitator sees a short note that the entries are now visible to everybody | The reveal and discuss steps can never show a board with hidden entries; one click is enough | Q5 (cycle 1) |

## Technical Design

### Project structure (additions)
```
src/flow/
  types.ts               PhaseId, RetroStep, StopId, FlowState, TimerState
  stops.ts               STOPS order, labels, next/prev/goto helpers, stop → phase/step mapping
  timer.ts               pure timer functions (start, pause, reset, remaining, used)
  suggested.ts           suggestedMs(stop, format, budget) incl. fallback from default shares
  flowIntents.ts         registers the flow.* intent handlers (Facilitator-only)
  flowView.ts            view filter: Facilitator-only counts; helper isRevealed(state, key)
  registries.ts          registerPhaseView, registerPhaseControls, registerContributionCounter
  clock.ts               HostClock (estimates the host's time on this device from hostTime in messages)
  sound.ts               SoundPlayer (Web Audio beep, unlock) and mute logic
  prefs.ts               device preferences (own mute) in localStorage under retro.prefs
  data/phases.json       phase and step texts and default shares
  data/schema.ts         Zod schema for phases.json
src/ui/flow/
  FlowShell.tsx, PhasePanel.tsx, TimerWidget.tsx, FacilitatorControls.tsx, ProgressOverview.tsx,
  ReviewActionsPanel.tsx, ContributionCounter.tsx, SoundControls.tsx, FacilitatorGuide.tsx, NotSyncedBadge.tsx
tests/flow/ ...          unit and component tests
e2e/epic3-guided-flow.spec.ts, e2e/fixtures/fakeContributions.ts
```

### Data model
```ts
type PhaseId = 'checkIn' | 'reviewActions' | 'retro' | 'notes' | 'actions' | 'checkOut';   // from Epic 2: PHASES
type RetroStep = 'write' | 'reveal' | 'discuss';                                            // from Epic 2: RETRO_STEPS
type StopId = 'checkIn' | 'reviewActions' | 'retro.write' | 'retro.reveal' | 'retro.discuss'
            | 'notes' | 'actions' | 'checkOut';

interface TimerState {
  status: 'idle' | 'running' | 'paused';
  startedAt?: number;      // host clock (ms) when the timer was last started
  remainingMs?: number;    // remaining time at startedAt (running) or when paused; undefined = the full suggested time
}

interface FlowState {                         // stored at state.extensions.flow
  stop: StopId;                               // current stop; initial 'checkIn'
  timers: Partial<Record<StopId, TimerState>>;
  revealed: { checkIn: boolean; retro: boolean };
  soundMutedForAll: boolean;
}

// only in the Facilitator's view, never stored (computed by the contribution counters):
interface FlowCounts { [key in 'checkIn' | 'retro']?: { added: number; total: number } }
```
- `getFlow(state)` returns the stored slice or the initial one (`stop: 'checkIn'`, no timers, nothing revealed, not muted), so no change to Epic 1's session creation is needed.
- Suggested time per stop in ms: `suggestedMs(stop, format, budget)` takes it from `format.timeSplits[budget]` (`checkIn`, `reviewActions`, `retro.write|reveal|discuss`, `notes`, `actions`, `checkOut`) × 60,000. If a format has no split for the budget (for example Epic 1's placeholder format), it falls back to `defaultShare` from `phases.json` × budget minutes, rounded to whole minutes.
- Remaining time: `remaining(timer, durationMs, hostNow)` is `durationMs` when `idle` and `remainingMs` undefined; `remainingMs` when `paused`; and `remainingMs ?? durationMs` minus `(hostNow − startedAt)` when `running`. A negative value means overtime.
- Time used: `used(timer, durationMs, hostNow) = max(0, durationMs − remaining(...))`, so overtime counts as used time.
- Planned total = sum of `suggestedMs` of all eight stops (equals the chosen budget for formats with valid splits).

`phases.json` (checked with a Zod schema; every field required):
```json
{
  "phases": [
    { "id": "checkIn", "title": "Check-in", "oneLine": "Everyone writes a short answer to the warm-up question.",
      "instruction": "Read the question aloud. Give everybody a minute to write. When the timer ends or everybody is done, press Reveal and let each person read their own answer.",
      "defaultShare": 0.10 },
    { "id": "reviewActions", "title": "Review of previous action items", "oneLine": "Open the notes from your last retro and look at the action items together.", "instruction": "…", "defaultShare": 0.10 },
    { "id": "retro", "title": "Retrospective", "oneLine": "…", "instruction": "…", "defaultShare": 0.54 },
    { "id": "notes", "title": "Discussion notes", "oneLine": "…", "instruction": "…", "defaultShare": 0.06 },
    { "id": "actions", "title": "Action items", "oneLine": "…", "instruction": "…", "defaultShare": 0.12 },
    { "id": "checkOut", "title": "Check-out", "oneLine": "…", "instruction": "…", "defaultShare": 0.08 }
  ],
  "retroSteps": [
    { "id": "write", "oneLine": "…", "instruction": "…", "defaultShare": 0.16 },
    { "id": "reveal", "oneLine": "…", "instruction": "…", "defaultShare": 0.10 },
    { "id": "discuss", "oneLine": "…", "instruction": "…", "defaultShare": 0.28 }
  ],
  "guide": [ { "title": "If your browser closes", "text": "Reopen the tool on the same device and choose Resume session. Teammates reconnect by themselves. The Facilitator role cannot be handed to somebody else in this version." } ]
}
```
The retro phase's `defaultShare` is the sum of its three steps (0.16 + 0.10 + 0.28 = 0.54), and all shares sum to 1.0 (checked by the schema test). The `…` texts are written in T-1 in plain English for people without coaching background.

### Modules and components

**`flow/stops.ts`**: `STOPS: StopId[]` (the eight stops in order), `stopToPhase(stop)`, `stopToStep(stop)`, `label(stop)`, `next(stop)` and `prev(stop)` (stay at the ends), `isRetro(stop)`.

**`flow/timer.ts`**: pure functions `start(timer, durationMs, hostNow)`, `pause(timer, durationMs, hostNow)`, `reset()`, `remaining(...)`, `used(...)`. Start on a `running` timer and pause on a non-running timer do nothing. Reset returns `{ status: 'idle' }` (full time again).

**`flow/flowIntents.ts`** (registers handlers with Epic 1's `registerIntentHandler`; each handler receives the sender's participant ID, the state, and the host's `now`):
- All `flow.*` intents are rejected unless the sender's participant has `isFacilitator`, or the session is not `running` (AC-3).
- `flow.goto { stop }`, `flow.next`, `flow.prev`: pause the timer of the stop being left if it is running (remaining time kept); set `stop`; never start a timer; arriving at `retro.reveal` or `retro.discuss` (from any stop, by next or goto) also sets `revealed.retro = true` (AD-16), so those steps never show hidden entries; arriving at `retro.write` or any other stop does not change reveal flags.
- `flow.reveal { key: 'checkIn' | 'retro' }`: allowed when the current stop belongs to that phase (check-in, or any retro stop); sets `revealed[key] = true`; when the current stop is `retro.write` it also moves to `retro.reveal`. Idempotent and never reversed.
- `flow.timer { action: 'start' | 'pause' | 'reset' }`: acts on the timer of the current stop only; `start` uses `suggestedMs` of the stop.
- `flow.muteAll { muted: boolean }`.
- Every accepted intent increments `rev` through the Epic 1 reducer path and is delivered as an item update of `extensions.flow` (the whole slice is small).

**`flow/flowView.ts`**: registers a view filter with Epic 1's `registerViewFilter`: for non-Facilitators it removes any `counts`; for the Facilitator it adds `counts` computed by the registered contribution counters. Exports `isRevealed(state, key)` (used by Epic 4's view filter to decide which entries are withheld) and `FLOW_KEY = 'flow'`.

**`flow/registries.ts`** (the extension points for Epic 4)
- `registerPhaseView(stop | phase, Component)`: the content area shown for a stop; props: `{ stop, state, isFacilitator, revealed }`. Default: a placeholder text "Content for this phase is added by the contributions module".
- `registerPhaseControls(stop | phase, Component)`: extra Facilitator controls for a stop (Epic 4 uses it for "Close survey").
- `registerContributionCounter(key, fn(state) => { added, total })`: computed on the host from the full state; without Epic 4 the counter returns `{ added: 0, total: <participants> }`.

**`flow/clock.ts`**: `HostClock { observe(hostTime: number, receivedAt: number): void; hostNow(): number }` keeps an offset estimate between the host's clock and this device's clock, so `hostNow()` returns the estimated host time. Every host-to-client message carries `hostTime` (the host's `Date.now()` at send time); on receipt the client calls `observe(hostTime, Date.now())`, which records `receivedAt − hostTime` in a window of the last 30 observations; the estimate is the smallest value in the window (so network delay never makes the host's clock look later than it is), and `hostNow() = Date.now() − estimate`. The first observation comes from the `welcome` message. While the Facilitator is offline no new observations arrive and the last estimate is kept. On the host itself, `hostNow()` is `Date.now()`.

**`flow/sound.ts`**: `SoundPlayer { unlock(): void; beep(): boolean }`, plus `shouldPlay(state, localMuted)`: sound is played only when `!soundMutedForAll && !localMuted`. The player uses the Web Audio feature: one `AudioContext`, created on the first call of `unlock()`; `unlock()` is called by a one-time `pointerdown`/`keydown` listener installed at app start and by the join and create actions; the context is resumed when the tab becomes visible again and before each beep; `beep()` plays a 0.25 s sine tone at 880 Hz with a short fade-out and returns whether it played; any failure (no Web Audio, context blocked) is swallowed and returns `false`, and never hides the visual alert. A `TimerWatcher` on every device schedules a timeout for the running timer's remaining time; when the remaining time crosses zero, it marks the stop as "over" and calls the player once per (stop, `startedAt`) pair, so a reconnect or re-render does not replay it and a device that joins after the time is over stays silent.

**`flow/prefs.ts`**: `getLocalMuted()` / `setLocalMuted()` in `localStorage` key `retro.prefs` (wrapped in try/catch).

**UI**
- `FlowShell`: rendered by Epic 1's `SessionShell` when the session is `running`; shows the stop list (`ProgressOverview` for the Facilitator, a simple "step n of 8" label for participants), the `PhasePanel`, the timer, the phase content area, and `SoundControls`.
- `PhasePanel`: Facilitator: title, full instruction (and for retro stops also the retro-step instruction and the format's facilitation tips), the controls; participants: title and the one-line text.
- `FacilitatorControls`: Previous, Next, Reveal (only in check-in and retro stops, disabled once revealed), timer Start/Pause/Reset, "Mute sound for everybody", plus controls registered by `registerPhaseControls`.
- `TimerWidget`: shows `mm:ss` remaining, the suggested time, state (idle, running, paused), "time is over" banner (always, also when the sound is muted) with the overtime counting up (for example "+02:15") after zero; while the connection status is `facilitator-offline` it keeps counting from the last known host-time estimate and shows `NotSyncedBadge` ("Not synchronized").
- `ProgressOverview` (Facilitator): the eight stops with planned minutes and used time, the current stop highlighted; each stop is selectable (`flow.goto`); a total line "used X min of Y planned".
- `ReviewActionsPanel`: the text "Open the documentation from your last retro (for example in Confluence or Miro) and look at the action items together. This tool does not store or import them." (from `phases.json`), no inputs.
- `ContributionCounter`: Facilitator-only "5 of 7 have added something" in the write step of check-in and retro, from `counts`.
- `SoundControls`: a mute toggle for this device (default on), and for the Facilitator "Mute sound for everybody"; participants see "Sound is muted by the Facilitator" when that is set.
- `FacilitatorGuide`: an info dialog from `phases.json.guide` available in the session header for the Facilitator, including the limitation that the Facilitator role cannot be handed over.
- Mobile-first layout; accessible names for all controls; texts in `texts.ts`; the stop list collapses on small screens.

### Interfaces
- **Epic 1:** `registerIntentHandler`, `registerViewFilter` (existing); Epic 1's message envelope gets a `hostTime` field on every host-to-client message (the host's `Date.now()` at send time; the client passes it with the receive time to `HostClock.observe`); `SessionShell` renders `FlowShell`; the connection status `facilitator-offline` is read from Epic 1's `ui/store`.
- **Epic 2:** `Format.timeSplits`, `facilitationTips`, `PHASES`, `RETRO_STEPS`.
- **Epic 4:** `isRevealed(state, 'checkIn' | 'retro')`, `registerPhaseView`, `registerPhaseControls`, `registerContributionCounter`; Epic 4 also withholds entries of others until revealed using `isRevealed`, and shows entries added after the reveal immediately.
- **Epic 5:** none.

### Key flows

**Journey 1: Facilitator runs the session phase by phase.** Start in the lobby (Epic 1) → `running` → `FlowShell` at stop `checkIn`. The Facilitator sees the full instruction, the suggested time (from the format's split) and the timer controls; participants see the one-line text and the timer. Start timer → `flow.timer start` → every device computes the remaining time from the host's start time and its `HostClock`. Next → `flow.next` → all devices show the next stop. After `checkOut`, Next is disabled and the Facilitator ends the session with Epic 1's "End session" (documentation follows in Epic 5).

**Journey 2: Retrospective phase with three steps.** At `retro.write` participants write (Epic 4 content area), entries of others are hidden because `revealed.retro` is false. The Facilitator sees "5 of 7 have added something". Reveal → `flow.reveal { key: 'retro' }` → `revealed.retro = true`, stop `retro.reveal`; Epic 4's view filter now includes everybody's entries. Next → `retro.discuss`. Each step has its own instruction and its own timer.

**Journey 3: Facilitator reveals check-in entries.** Same as Journey 2 with `key: 'checkIn'` at stop `checkIn`.

**Journey 4: Review of previous action items.** `ReviewActionsPanel` shows the reminder; nothing is stored; the Facilitator moves on with Next.

**Journey 5: Facilitator goes back.** Prev or selecting a stop in the progress list → `flow.goto`; the timer of the stop being left is paused; at the earlier stop the timer shows its previous remaining time, paused; Reset sets the full time; content stays editable (Epic 4).

**Journey 6: Timer runs out.** On each device the `TimerWatcher` fires at zero → the "time is over" banner is shown (and the overtime counting up); the sound plays once unless muted on the device or for everybody; nothing else changes. The Facilitator continues, or moves on.

**Journey 7: Facilitator drops out.** Epic 1 reports `facilitator-offline` → `TimerWidget` shows the badge "Not synchronized" and keeps counting from the last known estimate; the stop and the last known state remain. When the Facilitator resumes on the same device, Epic 1 restores the host record including `extensions.flow` and the host's start times; clients receive a snapshot with the host time and recompute remaining times. No handover is offered (AC-18); `FacilitatorGuide` explains the limitation.

**Journey 8: Late entries after the reveal.** Entries are Epic 4's; this epic guarantees that `revealed.<key>` stays true after the reveal (even when the Facilitator goes back to the write step), so Epic 4's filter shows later entries to everybody at once.

## Implementation Tasks

Tasks are ordered; T-1 to T-4 can run in parallel; T-5 needs T-2 to T-4; T-6 needs T-5; T-7, T-8 are independent of T-5; the UI task T-9 needs T-1 to T-8; T-10 integrates with Epic 1.

### T-1: Instruction data file and schema
- **Satisfies:** FR-3.3, FR-3.5, FR-3.11; NFR-4, NFR-5; AC-6, AC-12, AC-18, AC-21
- **Depends on:** none (uses the project scaffold of Epic 1)
- **Tests first (TDD):**
  - `tests/flow/phases.schema.test.ts`: `phases.json` passes the schema; it has the six phases in the order of `PHASES` and the three retro steps in the order of `RETRO_STEPS`; every phase has non-empty `oneLine` and `instruction`; the default shares sum to 1.0 and the retro phase's share equals the sum of its three steps; the review phase text contains the reminder to open the documentation of the last retro and says nothing is stored or imported; the guide contains the note that the Facilitator role cannot be handed over; a file with a missing field or a share sum of 0.9 fails with a message naming the field.
  - `tests/flow/phases.edit.test.ts`: changing an instruction text in a copy of the data file changes the text returned by the loader without any code change (AC-21).
- **Implementation:** `flow/data/phases.json` with real texts in plain English (no coaching terms without explanation), `flow/data/schema.ts`, a loader `getPhaseTexts()`.
- **Done when:** tests pass.

### T-2: Stops and navigation helpers
- **Satisfies:** FR-3.1, FR-3.2; AC-1, AC-5
- **Depends on:** none
- **Tests first (TDD):**
  - `tests/flow/stops.test.ts`: `STOPS` is exactly the eight stops in the specified order; the six phases appear in the fixed order (Check-in, Review of previous action items, Retrospective, Discussion notes, Action items, Check-out) when stops are mapped to phases; `next` and `prev` move along the list and stay at the ends; `stopToStep('retro.write')` is `write`, other stops have no step; labels exist for every stop.
- **Implementation:** `flow/types.ts`, `flow/stops.ts`.
- **Done when:** tests pass.

### T-3: Timer functions
- **Satisfies:** FR-3.4, FR-3.12; AC-9, AC-10, AC-11, AC-24
- **Depends on:** none
- **Tests first (TDD):**
  - `tests/flow/timer.test.ts`: an idle timer has the full duration remaining; `start` at host time 1,000 with a 5-minute duration gives 5:00 at 1,000, 4:59 at 2,000, 0:00 at 301,000 and −0:10 (overtime) at 311,000; `pause` at 61,000 stores `remainingMs = 240,000` and the remaining time no longer changes; `start` after pause continues from the stored remaining time; `reset` returns to idle with the full duration; `start` on a running timer and `pause` on a paused timer change nothing; `used` is duration minus remaining and is never negative, including overtime (e.g., 5:00 duration, −0:10 remaining → 5:10 used).
- **Implementation:** `flow/timer.ts` (pure, no clock access; the caller passes `hostNow`).
- **Done when:** tests pass.

### T-4: Suggested times
- **Satisfies:** FR-3.4, FR-3.8; AC-8, AC-23
- **Depends on:** T-1, T-2
- **Tests first (TDD):**
  - `tests/flow/suggested.test.ts`: with a format whose 50-minute split is checkIn 5, reviewActions 5, retro 8/5/14, notes 3, actions 6, checkOut 4, `suggestedMs` returns 5, 5, 8, 5, 14, 3, 6 and 4 minutes (in ms) for the eight stops and the total equals 50 minutes; for a custom format the generic default split of Epic 2 is used (30, 50 and 80 each sum to the total); for a format without a split for the budget (placeholder), the fallback uses `defaultShare × budget`, rounded to whole minutes, and the eight values are non-negative and add up to the budget ±1 minute.
- **Implementation:** `flow/suggested.ts`.
- **Done when:** tests pass.

### T-5: Flow intents (host side)
- **Satisfies:** FR-3.2, FR-3.4, FR-3.7, FR-3.8, FR-3.9, FR-3.12, FR-3.13; AC-2, AC-3, AC-5, AC-9, AC-14, AC-15, AC-24, AC-25
- **Depends on:** T-2, T-3, T-4
- **Tests first (TDD):**
  - `tests/flow/intents.permissions.test.ts`: with the Epic 1 reducer and memory transport, a non-Facilitator sending `flow.next`, `flow.goto`, `flow.timer`, `flow.reveal` or `flow.muteAll` changes nothing and is rejected; the Facilitator's intents are applied; flow intents are rejected when the session is in `lobby` or `ended`.
  - `tests/flow/intents.navigation.test.ts`: `flow.next` walks through all eight stops in order and stops at `checkOut`; `flow.prev` walks back; `flow.goto` jumps to any stop; leaving a stop with a running timer pauses it and keeps its remaining time; arriving at a stop never starts its timer; going back to a paused stop shows its remaining time, paused; `flow.timer reset` restores the full time (AC-24).
  - `tests/flow/intents.reveal.test.ts`: `flow.reveal` with key `checkIn` works only in the check-in stop and key `retro` only in a retro stop; revealing sets the flag and in `retro.write` moves to `retro.reveal`; revealing twice is a no-op; the flag stays true after going back to `retro.write` (AC-25 groundwork); `isRevealed(state, key)` reflects the flags.
  - `tests/flow/intents.timer.test.ts`: start, pause, reset act only on the current stop's timer; start uses the stop's suggested duration; the host's time is used for `startedAt`.
  - `tests/flow/intents.mute.test.ts`: `flow.muteAll` toggles `soundMutedForAll`.
  - `tests/flow/intents.resume.test.ts`: after a host restart from the persisted record (Epic 1 persistence), stop, timers, reveal flags and mute-all are restored; a running timer keeps its start time so the remaining time continues correctly.
  - `tests/flow/intents.next.reveal.test.ts`: `flow.next` from `retro.write` sets `revealed.retro` and lands on `retro.reveal`; `flow.goto retro.discuss` from `checkIn` also sets `revealed.retro`; `flow.next` from `checkIn` to `reviewActions` does not set any reveal flag; going back to `retro.write` keeps `revealed.retro` true; a participant's view built after `flow.next` includes everybody's retro entries (with the fake contributions filter).
- **Implementation:** `flow/flowIntents.ts`, registration at app start.
- **Done when:** tests pass.

### T-6: Flow view filter and registries
- **Satisfies:** FR-3.7, FR-3.10; AC-14, AC-17
- **Depends on:** T-5
- **Tests first (TDD):**
  - `tests/flow/view.test.ts`: the Facilitator's view contains `counts` from the registered counters; a participant's view never contains `counts` (also when the same state is projected for each participant); the counter function receives the full state (including hidden entries) but only `{ added, total }` reaches the view (no names, no content); without a registered counter the counts are `{ added: 0, total: n }`.
  - `tests/flow/registries.test.ts`: a registered phase view is returned for its stop or phase; the default placeholder is returned otherwise; registered phase controls are returned in registration order; registering a counter for the same key twice throws.
- **Implementation:** `flow/flowView.ts`, `flow/registries.ts`.
- **Done when:** tests pass.

### T-7: Host clock and timer watcher
- **Satisfies:** FR-3.4, FR-3.9; AC-4, AC-9, AC-10, AC-11, AC-16, AC-20
- **Depends on:** T-3
- **Tests first (TDD):**
  - `tests/flow/clock.test.ts`: `observe(hostTime, receivedAt)` followed by `hostNow()` returns the host's time within the smallest observed delay; with observations whose delays are 40, 300 and 120 ms the estimate uses the 40 ms one; a delayed message does not move the estimate later; the window keeps only the last 30 observations; on the host, `hostNow()` equals the local time; a device whose clock is 5 minutes ahead of the host still shows the correct remaining time within 1 second; with no observations yet, `hostNow()` falls back to the local time.
  - `tests/flow/watcher.test.ts`: with fake timers, the watcher fires exactly once when a running timer reaches zero; pausing or resetting before zero cancels it; a timer that is already over when the device joins or reconnects does not fire the signal; a restarted timer (new `startedAt`) can fire again; overtime keeps counting.
  - `tests/flow/offline.test.ts`: while the connection status is `facilitator-offline`, the timer view model is marked "not synchronized" and keeps counting from the last known estimate (a running timer shows a smaller remaining time after 10 s of fake time); when the Facilitator returns and a snapshot arrives, the display is corrected to the host's remaining time and the "not synchronized" mark disappears; a paused timer stays unchanged while offline.
  - `tests/flow/overtime.test.ts`: after zero the view model has `over = true` and an overtime value that counts up (+0:01, +0:02, …); resetting the timer clears it; moving away from the stop pauses it and keeps the overtime as used time.
- **Implementation:** `flow/clock.ts`, a `useTimerView` hook (or equivalent) computing the display model, the `TimerWatcher`.
- **Done when:** tests pass.

### T-8: Sound and mute
- **Satisfies:** FR-3.4; AC-10, AC-22
- **Depends on:** none
- **Tests first (TDD):**
  - `tests/flow/sound.test.ts`: with a fake `AudioContext`, `unlock()` creates one context and later calls reuse it; `beep()` creates one oscillator at 880 Hz, starts it and stops it after 0.25 s, and returns `true`; a suspended context is resumed before the beep and when the page becomes visible; without Web Audio or when the context cannot start, `beep()` returns `false` and does not throw; the one-time `pointerdown` listener calls `unlock()` and removes itself.
  - `tests/flow/mute.test.ts`: `shouldPlay` is true only when neither the device nor the Facilitator muted; the device preference persists across reloads via `retro.prefs` and survives a throwing `localStorage`; the sound is on by default.
- **Implementation:** `flow/sound.ts`, `flow/prefs.ts`.
- **Done when:** tests pass.

### T-9: Flow screens
- **Satisfies:** FR-3.1 to FR-3.8, FR-3.10, FR-3.11; NFR-1, NFR-3, NFR-4; AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-10, AC-12, AC-13, AC-15, AC-17, AC-18, AC-22
- **Depends on:** T-1 to T-8
- **Tests first (TDD):**
  - `tests/ui/flow.shell.test.tsx`: the Facilitator sees Previous, Next, timer controls and the progress overview; a participant sees none of these controls; the stop list shows the six phases with the three retro steps under Retrospective.
  - `tests/ui/flow.panel.test.tsx`: the Facilitator sees the full instruction and, in retro stops, the format's tips; a participant sees only the title and the one-line text; the review stop shows the reminder text and no inputs.
  - `tests/ui/flow.timer.test.tsx`: the timer shows the suggested time for the stop from the format's split; Start, Pause and Reset change the display; at zero the "time is over" banner appears and the sound player is called once unless muted; after zero the banner shows "time is over" and the overtime counts up; "Not synchronized" appears and the display keeps counting when the Facilitator is offline. A further test `tests/ui/flow.reveal.note.test.tsx`: after the Facilitator moves from the write step to the reveal step, the Facilitator sees the note "Everybody can now see the entries"; participants do not see a note.
  - `tests/ui/flow.progress.test.tsx`: each stop shows its planned minutes and its used time; the total shows used versus planned; selecting a stop calls `flow.goto`.
  - `tests/ui/flow.counter.test.tsx`: the counter "N of M have added something" is shown to the Facilitator during write steps only, and never to participants.
  - `tests/ui/flow.sound.test.tsx`: the device toggle mutes only this device; "Mute sound for everybody" hides the sound for all and shows participants "Sound is muted by the Facilitator".
  - `tests/ui/flow.guide.test.tsx`: the Facilitator guide dialog opens and contains the note that the Facilitator role cannot be handed over; no control to hand over the role exists anywhere.
- **Implementation:** the components listed above, texts in `texts.ts`, the review text and guide from `phases.json`.
- **Done when:** tests pass; the screens work at 360 px width.

### T-10: Integration with Epic 1
- **Satisfies:** FR-3.9; AC-4, AC-16, AC-20; NFR-2
- **Depends on:** T-5 to T-9 and the Epic 1 implementation
- **Tests first (TDD):**
  - `tests/flow/integration.test.tsx`: with the real Epic 1 host and client controllers on the memory transport: when the host starts the session all clients show the flow at `checkIn`; a client that joins late sees the current stop and a correct timer; a client that reloads while a timer runs shows the correct remaining time; when the host stops, clients show `Facilitator offline` and the not-synchronized timer; when the host resumes from its record, the stop and the timer are restored and clients converge; every host-to-client message carries `hostTime` and the client clock uses it.
- **Implementation:** `SessionShell` renders `FlowShell`; the Epic 1 message envelope gets `hostTime` on every host-to-client message (`HostController` adds it on send, `ClientController` passes it to `HostClock.observe`); the handlers are registered at app start; the Epic 1 placeholder session content is removed.
- **Done when:** tests pass; a session can be run from Check-in to Check-out with the placeholder content areas.

### T-11: Usability check (manual)
- **Satisfies:** NFR-1, NFR-4; AC-19
- **Depends on:** T-9
- **Tests first (TDD):** Not applicable (manual). Deliverable: `docs/flow-usability-check.md` with the result of one session run by a first-time facilitator who has no coaching background, using only the on-screen guidance, and the list of texts they found unclear.
- **Implementation:** adjust the texts in `phases.json` according to the findings.
- **Done when:** the document exists and the texts are updated.

## Traceability
| AC | Tasks | Tests |
|----|-------|-------|
| AC-1 | T-2, T-9 | stops, ui/flow.shell, e2e J1 |
| AC-2 | T-5, T-10 | intents.navigation, integration, e2e J1 |
| AC-3 | T-5, T-9 | intents.permissions, ui/flow.shell, e2e J1 |
| AC-4 | T-7, T-10 | integration, e2e J1 (late join), e2e J6 |
| AC-5 | T-2, T-5, T-9 | stops, intents.navigation, e2e J4 |
| AC-6 | T-1, T-9 | phases.schema, ui/flow.panel, e2e J1 |
| AC-7 | T-9 | ui/flow.panel, e2e J2 |
| AC-8 | T-4, T-9 | suggested, ui/flow.timer, e2e J1 |
| AC-9 | T-3, T-5, T-7 | timer, intents.timer, clock, e2e J5 |
| AC-10 | T-3, T-7, T-8, T-9 | timer, watcher, overtime, sound, ui/flow.timer, e2e J5 |
| AC-11 | T-3, T-7, T-10 | timer, clock, integration, e2e J6 |
| AC-12 | T-1, T-9 | phases.schema, ui/flow.panel, e2e J3 |
| AC-13 | T-9 | ui/flow.progress, e2e J1 |
| AC-14 | T-5, T-6 | intents.reveal, view, e2e J2 |
| AC-15 | T-5, T-9 | intents.reveal, intents.next.reveal, ui/flow.shell, ui/flow.reveal.note, e2e J2 |
| AC-16 | T-7, T-10 | offline, integration, e2e J6 (PRD wording: the timer is "shown as not synchronized"; the spec shows it counting with that label, see AD-14) |
| AC-17 | T-6, T-9 | view, ui/flow.counter, e2e J2 |
| AC-18 | T-1, T-9 | phases.schema, ui/flow.guide, e2e J7 |
| AC-19 | T-11 | docs/flow-usability-check.md (manual) |
| AC-20 | T-7, T-10 | clock, integration |
| AC-21 | T-1 | phases.edit |
| AC-22 | T-8, T-9 | mute, ui/flow.sound, e2e J5 |
| AC-23 | T-4 | suggested, e2e J2 |
| AC-24 | T-3, T-5 | timer, intents.navigation, e2e J4 |
| AC-25 | T-5, T-6 | intents.reveal, e2e J8 (with the contributions fixture) |

| FR / NFR | Tasks |
|----------|-------|
| FR-3.1 | T-2, T-9 |
| FR-3.2 | T-2, T-5, T-9, T-10 |
| FR-3.3 | T-1, T-9 |
| FR-3.4 | T-3, T-4, T-5, T-7, T-8, T-9 |
| FR-3.5 | T-1, T-9 |
| FR-3.6 | T-4, T-9 |
| FR-3.7 | T-5, T-6, T-9 |
| FR-3.8 | T-4, T-5, T-9 |
| FR-3.9 | T-5, T-7, T-10 |
| FR-3.10 | T-6, T-9 |
| FR-3.11 | T-1, T-9 |
| FR-3.12 | T-3, T-5 |
| FR-3.13 | T-5, T-6 |
| NFR-1 | T-9, T-11 |
| NFR-2 | T-7, T-10 |
| NFR-3 | T-9 |
| NFR-4 | T-1, T-11 |
| NFR-5 | T-1 |

## E2E Test (Playwright)
The implement-epic skill builds and sets up this test later; this spec only describes it.

**File:** `e2e/epic3-guided-flow.spec.ts`, plus the fixture `e2e/fixtures/fakeContributions.ts`. One test per PRD journey. Participants are simulated with several browser contexts (Facilitator F, participants A and B), as in the Epic 1 e2e test, reusing its helpers `createSession` and `join`.

**How the app starts:** the same two web servers as in the Epic 1 e2e test: the local signaling server (`peer` package) and the e2e build served by `vite preview`, built with `.env.e2e`. The session is created with a known library format and time budget (for example "Start-Stop-Continue" and 50 minutes, so the check-in time is 5:00). The e2e build also enables the **fake contributions module** (`VITE_E2E_FAKE_CONTRIBUTIONS=true`), which registers through the registries of this epic a content area with an "Add test entry" button, a list of revealed entries labeled with author names, a counter and the view filter that hides others' entries until `isRevealed`. This stands in for Epic 4 until it exists; once Epic 4 is implemented, its own e2e tests cover the real behavior and the fixture is only used for the clock tests.

**Clock control:** every page gets `page.clock.install()` with different start times (A's clock 5 minutes ahead of F's), so the tests show that remaining times are shared correctly across devices; `page.clock.fastForward` / `runFor` advance time. The sound is counted by an init script that replaces `AudioContext`/`OscillatorNode` with spies and exposes `window.__beeps`.

**Tests:**
1. **J1 Phases walkthrough** — F creates and starts; F, A and B see "Check-in". F sees the full instruction and the buttons Previous, Next, Start timer (`getByRole('button')`); A sees only the one-line text and no such buttons (AC-3, AC-6). The timer reads "5:00" for check-in (AC-8). F presses Next repeatedly and A and B follow through the eight stops in the order Check-in, Review of previous action items, Retrospective (write, reveal, discuss), Discussion notes, Action items, Check-out (AC-1, AC-2); F's progress overview shows planned minutes and used time and the total (AC-13); a new context C joining late lands on the current stop (AC-4).
2. **J2 Retro steps and reveal** — at the retro write step A and B each press "Add test entry"; F sees "2 of 3 have added something" and no names; A and B do not see the counter (AC-17); other people's entries are hidden; F presses Reveal → all entries appear for everybody at once with author names, and the step changes to reveal (AC-14, AC-15); F presses Next → discuss; the three retro steps show their own suggested times from the split (AC-23). In a second run of this test, F does not press Reveal at the write step but presses Next: the entries are revealed to everybody at once, the step is "reveal", and F sees the note "Everybody can now see the entries" (AD-16). The same is checked once for the Check-in stop (Journey 3).
3. **J3 Review of previous action items** — at that stop all three see the reminder text to open the last retro's documentation and no input fields (AC-12).
4. **J4 Go back** — F starts the check-in timer, runs the clock for 60 s, presses Next (timer pauses), presses Previous → the timer shows 4:00 and is paused; F presses Reset → 5:00; the earlier content (a test entry) is still there and editable (AC-5, AC-24).
5. **J5 Timer runs out** — F starts the check-in timer; running the clock to zero shows "time is over" on F, A and B, and `window.__beeps` is 1 on each device (AC-10); running the clock 135 s further shows "+02:15" on all devices; A mutes their device, a second timer run gives A no beep while F and B still beep (AC-22); F presses "Mute sound for everybody": nobody beeps and participants see "Sound is muted by the Facilitator"; Start, Pause and Reset show the same remaining time on all devices although A's clock is 5 minutes ahead (AC-9, AC-20); the phase does not change automatically (AC-10).
6. **J6 Reconnect and Facilitator offline** — A reloads while the timer runs → A shows the correct remaining time (AC-11); F closes its page → A and B show "Facilitator offline" and the timer is marked "Not synchronized" and keeps counting (AC-16); F resumes (Epic 1 flow) → stop and timer are restored and A's display is synchronized again (AC-16).
7. **J7 Facilitator guide** — F opens the Facilitator guide and sees that the role cannot be handed over; no control to hand over the Facilitator role exists in the participant list or anywhere else (AC-18).
8. **J8 Late entries after the reveal** — after the reveal at the retro stop, B presses "Add test entry" → it is visible to F and A at once with B's name, without another reveal; F goes back to the write step, B adds another entry, and it is still visible at once (AC-25).

**Not covered by e2e (unit and component tests cover them):** AC-19 (manual usability check), AC-21, the details of AC-8 and AC-23 for custom formats, offline display variants.

**Stubbed:** the public PeerJS broker and STUN servers (local signaling server instead); the sound (spies); Epic 4's contributions (fake contributions module).
## Decision Log
### Cycle 1
- Q: How do devices with different clocks agree on the remaining time of a running timer? → A: The host adds its current time (`hostTime`) to every message it sends, and each device keeps an estimate of the difference to its own clock, using the smallest observed difference
- Q: How is the alert sound produced and made to work on desktop and mobile browsers? → A: A short beep generated with the Web Audio feature, with the audio context created or resumed on the first click or tap and resumed again when the tab becomes visible
- Q: What does the timer show while the Facilitator is offline? → A: The display keeps counting down with a "Not synchronized" label (chosen instead of the recommended freeze; the PRD wording "shown as not synchronized instead of counting as if it were authoritative" is read as: counting, but labeled as not authoritative)
- Q: What does a timer show after it reaches zero? → A: "Time is over" with the overtime counting up (for example "+02:15"), until the Facilitator resets or moves on
- Q: What should "Next" do when the Facilitator moves from the retro write step to the reveal step without pressing Reveal? → A: "Next" reveals the retro entries as well, and a short note says that the entries are now visible to everybody (design detail: the same applies when arriving at the discuss step by any route)

## Open Questions

None — confidence reached 90%.
