# Spec: Epic 4 — Participant Contributions

Confidence: 93%

PRD: [4_participant-contributions.md](4_participant-contributions.md)

## Overview
This spec turns the Epic 4 PRD into an implementable design. It covers:

- The contribution data (check-in responses, retro entries, discussion note items, action items, exit survey) as one extension slice `extensions.contrib` of the host-authoritative session state
- The intents that change it (author and role rules, text limits, idempotent re-sends)
- Hidden-until-reveal: the view filter that withholds other people's entries, the "added something" counters and the removal hook
- The anonymous exit survey
- Showing a participant's own unacknowledged writes while offline
- The screens for each phase, plugged into the Epic 3 flow through its registries
- A pure summary function that Epic 5 reads to build the documentation

**Design principle:** all rules (validation, permissions, visibility, aggregation) are pure TypeScript functions shared by the host, by the client overlay and by the tests. The UI renders what the view filter delivers and sends intents.

**Dependencies on other epics' specs:**
- **Epic 1:** `registerIntentHandler`, `registerViewFilter`, `registerRemovalHook`, per-recipient updates and the client outbox with `opId`s, local participant record (`lastState`, `outbox`), `viewFor`, displayName of participants. Epic 4 asks for two small additions to Epic 1 (see Interfaces): anonymous intents and a generic item-level view diff.
- **Epic 2:** `Format.columns` (retro columns) and `Format.checkInQuestion`.
- **Epic 3:** `registerPhaseView`, `registerPhaseControls`, `registerContributionCounter`, `isRevealed(state, key)`, the flow stops, and the reveal flags.
- **Epic 5 (later):** reads `buildContributionSummary(state)`.

## Key Architecture Decisions
| # | Decision | Choice | Rationale | Source |
|---|----------|--------|-----------|--------|
| AD-1 | Stack, tests, UI state | TypeScript, Vite, Preact, Vitest with @testing-library/preact, @preact/signals | Fixed by earlier decisions | Epic 1 spec AD-1, AD-9, AD-10 |
| AD-2 | Where contributions live | The extension slice `extensions.contrib` of the host-authoritative state; participants send intents; the host applies them; unrevealed entries of others are withheld from each recipient's view | Fixed in the PRD and Epic 1 | PRD FR-4.3, FR-4.7; Epic 1 spec AD-5, AD-12 |
| AD-3 | Item identity | Every entry, note item and action item has a client-generated ID; applying the same intent twice never creates a duplicate | Fixed in the PRD | PRD NFR-4 |
| AD-4 | Notes | A list of separate note items; anyone can add and edit any item (the later change replaces the earlier one); only the Facilitator deletes; the note taker is a label | Fixed in the PRD | PRD Q1, Q5 (cycle 1), Q8 (cycle 2), FR-4.4, FR-4.8 |
| AD-5 | Entries | At most 280 characters; no limit on the number; only the author edits or deletes their own entries until the session ends; the Facilitator can delete any entry | Fixed in the PRD | PRD Q2, Q3 (cycle 1), FR-4.8, FR-4.9 |
| AD-6 | Action items | One or more owners (at least one) chosen from the participants, optional due date, anyone can edit, the Facilitator deletes; an owner who is removed or has left stays as plain text | Fixed in the PRD | PRD Q6 (cycle 1), Q10 (cycle 2), FR-4.5, FR-4.11 |
| AD-7 | Survey | 1-5 rating plus comment for the retro and for the tool; results anonymous; answers changeable until the Facilitator closes the survey; the group sees only a count of answers | Fixed in the PRD | PRD Q7 (cycle 1), Q9 (cycle 2), FR-4.6, FR-4.10 |
| AD-8 | Plain text only | Entries, notes, descriptions and comments are plain text (line breaks kept); they are always rendered as text (never as HTML) | Safe by default in Preact; Epic 5 escapes per export format | PRD NFR-3 (no content leaves the browsers) |
| AD-9 | Character counting | Limits count Unicode code points (so an emoji counts as one); line breaks count as one character | Matches what people see | — (design choice within PRD FR-4.9) |
| AD-10 | No restriction by phase | Entries, notes, action items and survey answers can be added while the session is `running`, whatever stop the flow is at; the screens only offer them in their phase | PRD says earlier content stays editable (Epic 3) | PRD Journeys, Epic 3 FR-3.2 |
| AD-11 | How the anonymous survey keeps answers changeable | Each device keeps a random answer key in its own participant record; the host stores answers only under that key, with no participant ID; views send a shuffled list of answers without keys; survey intents are "anonymous" intents (the host does not record the sender) | The only option where the host never stores who gave which rating; answers stay changeable until close; the count is the number of keys | Q1 (cycle 1), architecture advisor |
| AD-12 | How a participant sees their own unacknowledged writes while offline | The unacknowledged outbox intents are applied on top of the last received state with the same pure rule functions as the host (in a mode that skips host-only checks); computed on read and never saved into the stored state | One set of rules for host and device; entries appear and disappear correctly on confirm or reject; no second store | Q2 (cycle 1), architecture advisor |
| AD-13 | How per-recipient changes are computed | A generic diff of the recipient's previous and new view down to item level (extension → collection → item ID); an update is sent only when the diff is not empty | Correct for any view rule by construction (reveal, edit, removal); cheap at 8 participants; a reveal of N entries is one update with N changes | Q3 (cycle 1), architecture advisor |
| AD-14 | Check-in responses | One response per participant; writing again edits it | Matches "each participant writes a response"; keeps the counter simple | Q4 (cycle 1) |
| AD-15 | When survey results are shown | After the Facilitator closes the survey (or the session ends); before that the group sees only the count "n of m answered" | Answers can still change until the close; nobody is influenced by early comments | Q5 (cycle 1) |
| AD-16 | Survey ratings | Both ratings (retro and tool) are required; both comments are optional | Averages stay meaningful and the form stays quick | Q6 (cycle 1) |
| AD-17 | Removed participants | Their check-in responses and retro entries are hidden from every view, counter and the documentation but stay stored on the Facilitator's device until the local data is removed; note items and action items stay, owners stay as plain text; their anonymous survey answers stay (they cannot be told apart) | Satisfies "their entries are no longer part of the session" without deleting data (chosen instead of the recommended deletion) | Q7 (cycle 1) |
| AD-18 | Length limits | Entries and check-in responses 280, note items 1,000, action item descriptions 280, survey comments 500 characters | Notes can hold a sentence or two of discussion; actions stay short for the documentation table | Q8 (cycle 1) |

## Technical Design

### Project structure (additions)
```
src/contrib/
  types.ts               Entry, NoteItem, ActionItem, SurveyAnswer, ContribState, intents, summary types
  limits.ts              length limits and text normalization (code-point counting)
  reducer.ts             applyIntent(state, actor, intent, mode): the pure rules for all contribution intents
  entries.ts             entry rules (add, edit, delete)
  notes.ts               note rules (add, edit, delete, note taker)
  actions.ts             action item rules (add, edit, delete, owners)
  survey.ts              survey rules and aggregation (submit, close, results)
  view.ts                contribution view filter, contribution counters, removal hook
  summary.ts             buildContributionSummary(state) for Epic 5
  register.ts            registers intents, filter, counters, removal hook, phase views and controls
  overlay.ts             overlay of unacknowledged intents on the last received state
src/ui/contrib/
  CheckInView.tsx, RetroBoard.tsx, EntryComposer.tsx, EntryCard.tsx,
  NotesView.tsx, NoteTakerControl.tsx, ActionsView.tsx, ActionForm.tsx,
  SurveyView.tsx, SurveyResults.tsx, SurveyControls.tsx, CharCounter.tsx
tests/contrib/ ...       unit and component tests
e2e/epic4-contributions.spec.ts
```

### Data model
```ts
type EntryKind = 'checkIn' | 'retro';

interface Entry {
  id: string;                 // client-generated (UUID)
  kind: EntryKind;
  columnId?: string;          // required for 'retro' (one of format.columns), absent for 'checkIn'
  text: string;               // 1 to 280 code points
  authorId: string;           // participant ID of the sender (set by the host, never by the client)
  createdAt: number;          // host time
  updatedAt: number;
}

interface NoteItem {
  id: string; text: string;   // 1 to 1,000 code points
  authorId: string; createdAt: number; updatedAt: number;
  lastEditorId?: string;
}

interface ActionOwner { participantId: string; name: string }  // name = display name when assigned (kept as plain text)

interface ActionItem {
  id: string;
  description: string;        // 1 to 280 code points
  owners: ActionOwner[];      // at least one
  dueDate?: string;           // 'YYYY-MM-DD', a valid calendar date
  createdBy: string; createdAt: number; updatedAt: number;
}

interface SurveyAnswer {
  retroRating: 1 | 2 | 3 | 4 | 5;      // required
  retroComment?: string;               // optional, up to 500 code points
  toolRating: 1 | 2 | 3 | 4 | 5;       // required
  toolComment?: string;                // optional, up to 500 code points
}

interface ContribState {      // stored at state.extensions.contrib
  entries: Record<string, Entry>;
  notes: Record<string, NoteItem>;
  actions: Record<string, ActionItem>;
  noteTakerId?: string;
  survey: { closed: boolean; answers: Record<string, SurveyAnswer> };   // keyed by answer key, never by participant (AD-11)
}
```
- `getContrib(state)` returns the stored slice or an empty one, so Epic 1 needs no change at session creation.
- What is stored for the survey carries no participant ID: the key under `answers` is a random answer key generated on the participant's device (AD-11).
- The survey is final when `survey.closed` is true or `state.status === 'ended'`.

**Per-recipient view** (what the view filter returns for participant P):
- `entries`: only entries with `authorId === P` or `isRevealed(state, entry.kind)`; the checks use the Epic 3 reveal flags.
- `notes`, `actions`, `noteTakerId`: all.
- `survey`: `{ closed, count, answers? }` where `count` is the number of stored answers; `answers` (a shuffled list of anonymous answers without keys) is present only when the survey is final (`closed` or the session has `ended`). Participants' own answers come from their local copy (AD-11), so they can see and change them before the close.
- Entries whose author has status `removed` are left out in every view (AD-17).

### Modules and components

**`contrib/limits.ts`**: `ENTRY_MAX = 280`, `NOTE_MAX = 1000`, `ACTION_DESCRIPTION_MAX = 280`, `COMMENT_MAX = 500`; `normalizeText(s)` converts `\r\n` to `\n`, trims leading and trailing whitespace; `length(s)` counts code points; `validateText(s, max)` returns `{ ok, text } | { ok: false, reason: 'empty' | 'too-long' }`. The input component truncates to the limit while typing (AC-17).

**`contrib/reducer.ts`**: `applyIntent(state, actor, intent, mode: 'host' | 'overlay'): { state, ok: boolean, reason?: string }` where `actor` is `{ participantId, isFacilitator }`. In `overlay` mode the Facilitator-only and host-only checks are skipped (the host stays the final judge). It never reads the clock: the host passes `now` in the context.

Intents (all registered with Epic 1's `registerIntentHandler`; the sender's participant ID is taken from the connection, never from the payload):
- `entry.add { id, kind, columnId?, text }`: session `running`; text valid; `retro` needs a `columnId` of the chosen format and `checkIn` must not have one; a participant can have only one `checkIn` entry: a second `entry.add` of kind `checkIn` by the same author is rejected with the reason `already-answered` (the UI turns the composer into an editor and uses `entry.edit`); an existing ID with the same author and same content is a no-op (idempotent), with another author it is rejected.
- `entry.edit { id, text }`: author only; sets `updatedAt`.
- `entry.delete { id }`: author or Facilitator.
- `note.add { id, text }`, `note.edit { id, text }` (anyone; replaces the text; sets `lastEditorId`), `note.delete { id }` (Facilitator only), `note.taker { participantId | null }` (Facilitator only; the participant must be active).
- `action.add { id, description, ownerIds, dueDate? }`: description valid; `ownerIds` has at least one ID and every ID is an active participant; owner names are stored as plain text snapshots; `dueDate` matches `YYYY-MM-DD` and is a real date, any date (also past) is accepted.
- `action.edit { id, description?, ownerIds?, dueDate? | null }`: anyone; the new `ownerIds` may contain active participants and owners that the action already has (so a removed owner can stay); still at least one owner.
- `action.delete { id }`: Facilitator only.
- `survey.submit { answerKey, answer }`: survey not closed and session not ended; `answer` valid (both ratings whole numbers 1-5; comments optional, at most 500 characters); replaces any earlier answer with the same key (naturally idempotent).
- `survey.close {}`: Facilitator only; sets `closed`.

**`contrib/view.ts`**
- `contribViewFilter(state, participantId)` as described above, registered with `registerViewFilter`.
- Counters registered with `registerContributionCounter('checkIn', fn)` and `('retro', fn)`: `added` = the number of distinct authors with at least one entry of that kind, `total` = the number of active participants; computed from the full state on the host, so they include hidden entries; only counts are returned.
- `registerRemovalHook` needs no data deletion (AD-17): the filter, the counters and `buildContributionSummary` skip entries whose author is `removed`; note items and action items stay and their owners are shown from the stored name snapshots. The hook only verifies that action owners keep their snapshots.

**`contrib/summary.ts`**: `buildContributionSummary(state): ContributionSummary` for Epic 5: check-in responses and retro entries by column (only revealed entries, with author display names), note items (with note taker), action items (owners, due dates), and survey results (count, averages per question, rating distribution, comments without names). It never includes unrevealed entries and never includes survey keys.

**`contrib/overlay.ts`**: derives what a participant sees from the last received state plus the unacknowledged outbox intents, using `applyIntent(..., 'overlay')`; the result is never written back into the stored `lastState`.

**`contrib/register.ts`**: called at app start: registers intents, view filter, counters, removal hook, and the phase views and controls below.

**UI**
- `CheckInView` (stop `checkIn`): shows `format.checkInQuestion`, the composer (or, once the participant has answered, an editor for their single response), the revealed responses with author names after the reveal.
- `RetroBoard` (stops `retro.write`, `retro.reveal`, `retro.discuss`): one column per `format.columns` entry (with prompt), stacked on narrow screens; in each column an `EntryComposer` and the entries; before the reveal a participant sees only their own entries; after the reveal everybody's entries with author labels; own entries have edit and delete controls; the Facilitator has a delete control on every entry. New entries after the reveal appear for everybody at once (the view filter includes them because the flag is set).
- `EntryComposer`: a text area with `CharCounter` ("123 characters left"), an Add button, the input stops at the limit (AC-17); Add is disabled when the text is empty; on mobile the text area opens on a single tap.
- `NotesView` (stop `notes`): list of note items, composer, edit in place, Facilitator delete; the note taker label ("Note taker: Sam") from `noteTakerId`; `NoteTakerControl` (Facilitator only, registered with `registerPhaseControls('notes', …)`) to choose or clear the note taker.
- `ActionsView` (stop `actions`) and `ActionForm`: description, owners as a multi-select of the active participants (required), due date with a date input (optional), list of action items with owners (as text), due date, edit for everyone, delete for the Facilitator.
- `SurveyView` (stop `checkOut`): two blocks (retro, tool), each with a 1-5 rating group (radio buttons with labels) and a comment text area; a Submit/Update button; the text "You can change your answers until the Facilitator closes the survey"; the count "6 of 7 answered"; `SurveyResults` (averages, distribution, the comments without names), shown only when the survey is final; `SurveyControls` (registered with `registerPhaseControls('checkOut', …)`) with "Close survey" and a confirmation.
- Names are shown with `displayName` for participants who are present, and with the stored name snapshot for owners who are gone (AC-23).
- Mobile-first layouts with large touch targets; every control has an accessible name; texts in `texts.ts`.

### Interfaces
- **Epic 1 (additions this epic needs):**
  1. `registerIntentHandler(type, handler, options?)` gets an option `{ anonymous: true }`: for these intents the host does not record the sender in `appliedOps` or anywhere in its persisted record; the handler receives no participant ID. Used by `survey.submit` (AD-11).
  2. The per-recipient update computation is a generic diff of the recipient's previous and new view down to item level (extension → collection → item ID, here `extensions.contrib.entries.<id>`), sending an update only when the diff is non-empty (AD-13); the host caches the last sent view per recipient.
- **Epic 3:** the registries listed above; `isRevealed(state, 'checkIn' | 'retro')`.
- **Epic 5:** `buildContributionSummary(state)`.

### Key flows

**Journey 1: Check-in.** At stop `checkIn`, `CheckInView` shows the question; a participant writes a response (`entry.add` with kind `checkIn`); only they see it; the Facilitator sees "N of M have added something" (Epic 3 counter); on Reveal (Epic 3) the view filter includes everybody's check-in entries and each is labeled with its author.

**Journey 2: Adding retro entries.** At the retro stops, `RetroBoard` shows the columns; `entry.add` with kind `retro` and a `columnId`; own entries can be edited (`entry.edit`) and deleted (`entry.delete`); others' entries stay hidden until `revealed.retro`; after the reveal everybody's entries show with authors; entries added later are visible at once; authors can still edit or delete theirs until the session ends.

**Journey 3: Writing discussion notes.** `NotesView`: anyone adds note items (`note.add`) and edits any item (`note.edit`); the Facilitator can mark a note taker (`note.taker`) and delete items (`note.delete`).

**Journey 4: Capturing action items.** `ActionForm` → `action.add` with description and owners (validation messages for an empty description or no owner); anyone edits (`action.edit`); the Facilitator deletes (`action.delete`).

**Journey 5: Check-out survey.** A participant submits (`survey.submit` with the device's answer key) and can change the answer until the Facilitator presses "Close survey" (`survey.close`); everybody sees "n of m answered" and no results until the survey is final; after closing (or when the session ends) the answers are final and everybody sees the aggregate and the comments.

**Journey 6: Reconnect or Facilitator offline.** While offline, a participant's intents stay in the Epic 1 outbox and the overlay shows them; when the host is back, the outbox is re-sent and the host applies each intent once (same IDs, or the same survey key replacing the same answer); on `rejected`, the overlay drops the intent and the participant sees a short message.

**Journey 7: Facilitator removes an inappropriate contribution.** The Facilitator's delete controls call `entry.delete`, `note.delete` or `action.delete`; the item disappears for everybody (the diff sends a deletion).

**Journey 8: Action item owner leaves the session.** On removal of the owner (Epic 1), the person's check-in responses and retro entries are hidden from every view and from the documentation (stored but not shown, AD-17); action items and note items stay; owners display with the stored name snapshot.

## Implementation Tasks

Tasks are ordered; T-1 first; T-2 to T-5 can run in parallel after T-1; T-6 needs T-2 to T-5; T-7 and T-8 need T-6; UI tasks T-9 to T-11 need T-6 and T-8; T-12 needs T-6.

### T-1: Types, text rules and limits
- **Satisfies:** FR-4.9; AC-17
- **Depends on:** none (uses the project scaffold of Epic 1)
- **Tests first (TDD):**
  - `tests/contrib/limits.test.ts`: `length` counts code points (an emoji counts as 1, a combining sequence counts per code point); `normalizeText` converts `\r\n` to `\n` and trims; `validateText('', 280)` is `empty`; a 280-character text is valid and a 281-character text is `too-long`; a text consisting of whitespace only is `empty`; `NOTE_MAX` is 1,000, `ACTION_DESCRIPTION_MAX` 280 and `COMMENT_MAX` 500, each with a boundary test (at the limit valid, one above too long).
  - `tests/contrib/types.test.ts`: `getContrib` returns an empty slice for a state without `extensions.contrib`, and the stored slice otherwise.
- **Implementation:** `contrib/types.ts`, `contrib/limits.ts`.
- **Done when:** tests pass.

### T-2: Entry rules
- **Satisfies:** FR-4.1, FR-4.2, FR-4.8, FR-4.9; AC-1, AC-2, AC-15, AC-16, AC-17, AC-20
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/contrib/entries.test.ts`: `entry.add` creates an entry with the sender as author (a forged `authorId` in the payload is ignored); `retro` needs a `columnId` that exists in the format and `checkIn` must not have one; text of 281 characters is rejected; adding is rejected when the session is not `running`; the same intent twice (same ID, same author, same text) results in one entry and no error; the same ID from another author is rejected; a second `checkIn` entry by the same author is rejected (`already-answered`) while a different author can add theirs, and editing the single response works; `entry.edit` works for the author only and updates `updatedAt`; `entry.delete` works for the author and the Facilitator and not for others; there is no limit on the number of entries (50 entries by one author are accepted).
- **Implementation:** `contrib/entries.ts`, `contrib/reducer.ts` (dispatch).
- **Done when:** tests pass.

### T-3: Note rules
- **Satisfies:** FR-4.4, FR-4.8; AC-6, AC-7, AC-16, AC-24
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/contrib/notes.test.ts`: anyone can add a note item; anyone can edit any item and the later change replaces the earlier text and sets `lastEditorId`; two edits on the same item arriving one after the other: the last applied wins; only the Facilitator can delete; a non-Facilitator deletion is rejected; the Facilitator can set and clear the note taker, who must be an active participant; a note taker does not change who may edit; empty text is rejected.
- **Implementation:** `contrib/notes.ts`.
- **Done when:** tests pass.

### T-4: Action item rules
- **Satisfies:** FR-4.5, FR-4.8, FR-4.11; AC-8, AC-9, AC-10, AC-16, AC-23
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/contrib/actions.test.ts`: an action without description or without owners is rejected; owners must be active participants (an unknown ID and a removed participant are rejected on add); several owners are accepted; owner names are stored as snapshots of the display names; `dueDate` accepts `2026-03-01` and rejects `2026-02-30` and `01.03.2026`; a past date is accepted; `action.edit` by anyone can change description, owners and due date and can clear the date; an edit that keeps an owner who has since been removed is accepted, while adding a removed participant is rejected; an edit that leaves no owner is rejected; only the Facilitator can delete; after the owner is removed from the session the action item remains and still shows the snapshot name.
- **Implementation:** `contrib/actions.ts`.
- **Done when:** tests pass.

### T-5: Survey rules and aggregation
- **Satisfies:** FR-4.6, FR-4.10; AC-11, AC-12, AC-21, AC-22
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/contrib/survey.test.ts`: a valid answer is stored under its key; a second submit with the same key replaces the first, so the count stays the same; two keys give a count of 2; ratings outside 1-5 or not whole numbers are rejected; an answer without the retro rating or without the tool rating is rejected, while empty comments are accepted; a comment of 501 characters is rejected and one of 500 is accepted; submissions after `close` are rejected, and so are submissions when the session has ended; `close` is Facilitator-only and idempotent; `aggregate(answers)` returns the number of answers, the average rating per question (one decimal), the distribution 1-5 and the list of comments; with no answers the averages are `null`; no stored object contains a participant ID.
  - `tests/contrib/survey.anonymous.test.ts`: after `survey.submit` through the host, the host record (persisted JSON) and the `appliedOps` log contain neither the sender's participant ID nor the token next to the answer; re-sending the same submit is harmless.
- **Implementation:** `contrib/survey.ts`.
- **Done when:** tests pass.

### T-6: View filter, counters and removal hook
- **Satisfies:** FR-4.3, FR-4.7, FR-4.8; AC-3, AC-4, AC-5, AC-13, AC-16
- **Depends on:** T-2 to T-5 and Epic 3's `isRevealed` and registries
- **Tests first (TDD):**
  - `tests/contrib/view.test.ts`: before the reveal, participant B's view contains B's own entries and none of A's; the Facilitator's view contains only the Facilitator's own entries too; after `revealed.retro` is true, B's view contains A's retro entries with `authorId` so the UI can show names; check-in and retro are revealed independently; an entry added by A after the reveal is in everybody's view; going back to the write step (flag stays true) does not hide entries again; notes, actions and the note taker are in every view; while the survey is open the survey view contains only `closed: false` and the count (no answers and never the keys); once closed (or the session has ended) it contains the answers in a shuffled order that does not reveal the submission order; the full state is never part of a participant's view (AC-3 and Epic 1 AC-22 with a spy on the sender).
  - `tests/contrib/counters.test.ts`: the check-in counter counts distinct authors with a check-in entry, the retro counter distinct authors with a retro entry, `total` is the number of active participants; the counters include hidden entries; a participant's view never contains the counts; removed participants are not counted, and their entries are not counted either.
  - `tests/contrib/removal.test.ts`: after a participant is removed, their check-in responses and retro entries are in no recipient's view (also after the reveal) and not in the summary, although they are still in the host's stored state; note items they wrote and action items they created stay; an action item they own keeps their name as plain text; a participant who only left (offline, not removed) keeps all entries visible.
- **Implementation:** `contrib/view.ts`, `contrib/register.ts` (registration).
- **Done when:** tests pass.

### T-7: Sync integration with Epic 1
- **Satisfies:** FR-4.3, FR-4.7; AC-3, AC-5, AC-13, AC-14, AC-19, AC-20
- **Depends on:** T-6 and the Epic 1 implementation
- **Tests first (TDD):**
  - `tests/contrib/sync.test.ts`: with the real host and client controllers on the memory transport: an entry added by A reaches only A until the reveal; the reveal reaches B as one update with all revealed entries (item-level changes); after the reveal a new entry reaches everybody; an entry deleted by the Facilitator is a deletion change for everybody who had it; a removed participant's entries disappear from every view (they stay stored on the host); a client that joins after the reveal receives the revealed entries in its first snapshot; the same intent re-sent after a drop does not create a duplicate (AC-20); the per-recipient item-level diff emits nothing when a change is not visible to the recipient (a hidden entry added by A causes no update for B).
  - `tests/contrib/anonymous.intent.test.ts`: an intent registered with `{ anonymous: true }` does not appear in `appliedOps` and the handler gets no participant ID.
  - `tests/contrib/scale.test.ts`: 8 clients each add 40 entries; all clients converge to the same revealed state after the reveal; the number of messages sent for the reveal is one update per recipient (AC-19).
- **Implementation:** the two Epic 1 additions described under Interfaces (anonymous option; generic item-level diff), `contrib/register.ts` wiring into the app start.
- **Done when:** tests pass.

### T-8: Own writes while offline (overlay)
- **Satisfies:** FR-4.7; AC-14, AC-20
- **Depends on:** T-2 to T-5 and the Epic 1 client controller
- **Tests first (TDD):**
  - `tests/contrib/overlay.test.ts`: with an outbox containing an `entry.add`, the overlaid state shows the own entry and the stored `lastState` is unchanged; after the acknowledgement the entry comes from the host state and is not shown twice; a rejected intent disappears from the overlay; edits and deletes of own entries are shown immediately; the overlay never shows other people's hidden entries; the survey overlay shows the participant's own answer from their local copy.
  - `tests/contrib/offline.test.ts`: while the host is offline the participant adds two entries and edits one; after reload the same entries are shown (outbox and `lastState` from localStorage); when the host returns, the two entries exist once on the host and for every participant after the reveal.
  - `tests/contrib/surveyKey.test.ts`: the answer key is created once per session on the device, stored in the participant record, reused for later changes, and never sent together with the participant token in the same message.
- **Implementation:** `contrib/overlay.ts`, the local survey fields in the participant record.
- **Done when:** tests pass.

### T-9: Check-in and retro screens
- **Satisfies:** FR-4.1, FR-4.2, FR-4.3, FR-4.8, FR-4.9; NFR-1, NFR-2; AC-1, AC-2, AC-4, AC-5, AC-15, AC-16, AC-17, AC-18, AC-19
- **Depends on:** T-6, T-8
- **Tests first (TDD):**
  - `tests/ui/contrib.checkin.test.tsx`: the format's check-in question is shown; a response can be added once and then edited (the composer becomes an editor); the counter "N of 280" shows the remaining characters and the input stops at 280 (AC-17); after the reveal, responses are shown with author names.
  - `tests/ui/contrib.retro.test.tsx`: columns and prompts of the chosen format are shown, stacked on a 360 px wide viewport; adding an entry needs only three interactions (tap the field, type, tap Add) (AC-18); own entries show edit and delete controls and others' do not; before the reveal only own entries are shown; after the reveal all entries are shown with author labels; the Facilitator sees a delete control on every entry; an entry added after the reveal appears at once.
  - `tests/ui/contrib.scale.test.tsx`: rendering 8 participants × 40 entries completes within a generous time budget and updates one entry without re-rendering all cards (keyed lists).
- **Implementation:** `CheckInView`, `RetroBoard`, `EntryComposer`, `EntryCard`, `CharCounter`.
- **Done when:** tests pass.

### T-10: Notes and action item screens
- **Satisfies:** FR-4.4, FR-4.5, FR-4.8, FR-4.11; AC-6, AC-7, AC-8, AC-9, AC-10, AC-16, AC-23, AC-24
- **Depends on:** T-6, T-8
- **Tests first (TDD):**
  - `tests/ui/contrib.notes.test.tsx`: note items can be added and edited by everyone; the note taker label is shown to everybody; `NoteTakerControl` is shown to the Facilitator only; delete is shown to the Facilitator only.
  - `tests/ui/contrib.actions.test.tsx`: saving without description or without owner shows an inline message; owners can be chosen only from the participants in the session; several owners can be chosen; the due date is optional; any participant can edit; delete is shown to the Facilitator only; after the owner is removed the item shows the owner's name as plain text.
- **Implementation:** `NotesView`, `NoteTakerControl`, `ActionsView`, `ActionForm`.
- **Done when:** tests pass.

### T-11: Survey screens
- **Satisfies:** FR-4.6, FR-4.10; AC-11, AC-12, AC-21, AC-22
- **Depends on:** T-5, T-6, T-8
- **Tests first (TDD):**
  - `tests/ui/contrib.survey.test.tsx`: both rating groups (1-5) and both comment fields are shown; submit stores the answer and the text says that it can be changed until the Facilitator closes the survey; changing the answer keeps the count the same; the count "n of m answered" is shown to everybody; no results are shown while the survey is open; after closing, the results (averages, distribution, comments) are shown and contain no names; the submit button is disabled until both ratings are chosen; "Close survey" is shown to the Facilitator only, asks for confirmation, and afterwards the form is read-only and the results are final.
- **Implementation:** `SurveyView`, `SurveyResults`, `SurveyControls`.
- **Done when:** tests pass.

### T-12: Summary for the documentation (Epic 5)
- **Satisfies:** FR-4.3, FR-4.6 (data provided to Epic 5); AC-4, AC-12
- **Depends on:** T-6
- **Tests first (TDD):**
  - `tests/contrib/summary.test.ts`: the summary contains revealed check-in responses and retro entries per column with author display names, note items with the note taker, action items with owners (as text) and due dates, and survey results (count, averages, distribution, comments without names); unrevealed entries are not included; entries of removed participants are not included; no survey keys or participant IDs appear anywhere in the summary object; with no contributions the summary has empty lists and `null` averages.
- **Implementation:** `contrib/summary.ts`.
- **Done when:** tests pass.

## Traceability
| AC | Tasks | Tests |
|----|-------|-------|
| AC-1 | T-2, T-9 | entries, ui/contrib.checkin, e2e J1 |
| AC-2 | T-2, T-9 | entries, ui/contrib.retro, e2e J2 |
| AC-3 | T-6, T-7 | view, sync, e2e J1, e2e J2 |
| AC-4 | T-6, T-9, T-12 | view, ui/contrib.retro, summary, e2e J1, e2e J2 |
| AC-5 | T-6, T-7, T-9 | view, sync, ui/contrib.retro, e2e J2 |
| AC-6 | T-3, T-10 | notes, ui/contrib.notes, e2e J3 |
| AC-7 | T-3, T-10 | notes, ui/contrib.notes, e2e J3 |
| AC-8 | T-4, T-10 | actions, ui/contrib.actions, e2e J4 |
| AC-9 | T-4, T-10 | actions, ui/contrib.actions, e2e J4 |
| AC-10 | T-4, T-10 | actions, ui/contrib.actions, e2e J4 |
| AC-11 | T-5, T-11 | survey, ui/contrib.survey, e2e J5 |
| AC-12 | T-5, T-11, T-12 | survey, survey.anonymous, ui/contrib.survey, summary, e2e J5 |
| AC-13 | T-6, T-7 | view, sync, e2e J1, e2e J3 |
| AC-14 | T-7, T-8 | sync, overlay, offline, e2e J6 |
| AC-15 | T-2, T-9 | entries, ui/contrib.retro, e2e J2 |
| AC-16 | T-2, T-3, T-4, T-6, T-9, T-10 | entries, notes, actions, view, ui/contrib.retro, ui/contrib.notes, ui/contrib.actions, e2e J3, e2e J7 |
| AC-17 | T-1, T-2, T-9 | limits, entries, ui/contrib.checkin, e2e J1 |
| AC-18 | T-9 | ui/contrib.retro, e2e J2 (mobile viewport) |
| AC-19 | T-7, T-9 | scale, ui/contrib.scale |
| AC-20 | T-2, T-7, T-8 | entries, sync, overlay, offline, e2e J6 |
| AC-21 | T-5, T-11 | survey, ui/contrib.survey, e2e J5 |
| AC-22 | T-5, T-11 | survey, ui/contrib.survey, e2e J5 |
| AC-23 | T-4, T-6, T-10 | actions, removal, ui/contrib.actions, e2e J8 |
| AC-24 | T-3, T-10 | notes, ui/contrib.notes, e2e J3 |

| FR / NFR | Tasks |
|----------|-------|
| FR-4.1 | T-2, T-9 |
| FR-4.2 | T-2, T-9 |
| FR-4.3 | T-6, T-7, T-9, T-12 |
| FR-4.4 | T-3, T-10 |
| FR-4.5 | T-4, T-10 |
| FR-4.6 | T-5, T-11, T-12 |
| FR-4.7 | T-6, T-7, T-8 |
| FR-4.8 | T-2, T-3, T-4, T-9, T-10 |
| FR-4.9 | T-1, T-2, T-9 |
| FR-4.10 | T-5, T-11 |
| FR-4.11 | T-4, T-6, T-10 |
| NFR-1 | T-9 |
| NFR-2 | T-7, T-9 |
| NFR-3 | T-7 (no network use is covered by the Epic 1 privacy tests that run the whole app) |
| NFR-4 | T-2, T-7, T-8 |

## E2E Test (Playwright)
The implement-epic skill builds and sets up this test later; this spec only describes it.

**File:** `e2e/epic4-contributions.spec.ts`. One test per PRD journey. Participants are simulated with browser contexts (Facilitator F, participants A and B), reusing the helpers of the Epic 1 and Epic 3 e2e tests (`createSession`, `join`, moving through the flow with the Facilitator's Next button). The real contributions module is used (the fake contributions fixture of Epic 3 is not loaded in this test).

**How the app starts:** the same two web servers as the Epic 1 e2e test: the local signaling server (`peer` package) and the e2e build served by `vite preview`, built with `.env.e2e`. The session uses the library format "Start-Stop-Continue" with 50 minutes (columns Start, Stop, Continue) and the three participants F "Fiona", A "Alex", B "Blake" (roles are free text).

**Tests:**
1. **J1 Check-in** — at the Check-in stop, A types a 281-character text: the field stops at 280 and shows "0 characters left" (AC-17); A and B each submit a response; F sees "2 of 3 have added something" (Epic 3 counter); A sees only their own response; F presses Reveal → A, B and F see both responses labeled "Alex" and "Blake" (AC-1, AC-3, AC-4, AC-13).
2. **J2 Retro entries** — at the retro write step A adds entries to Start and Stop, edits one and deletes one (own controls are available, B's entries show none for A) (AC-2, AC-15); B adds one entry to Continue; A sees only own entries (AC-3); F reveals → all entries appear in their columns with author names (AC-4); B adds another entry afterwards → visible to A and F at once (AC-5); B (viewport 390 × 844) adds an entry with three interactions (AC-18); the Facilitator deletes an entry of A (AC-16).
3. **J3 Notes** — at Discussion notes, A and B add note items and see each other's items in real time (AC-6, AC-13); F marks B as note taker: all see "Note taker: Blake" and A can still add and edit (AC-7); A edits B's item and the new text replaces the old on all devices (AC-24); A has no delete control, F deletes an item and it disappears for everybody (AC-16).
4. **J4 Action items** — at Action items, A tries to save without a description and then without an owner → inline messages (AC-9); A saves an action with description, owners "Alex" and "Blake" and a due date → visible to all (AC-8); the owner list contains only the three participants (AC-9); B edits the description and the owner list (AC-10); only F has a delete control and uses it (AC-16).
5. **J5 Survey** — at Check-out, A and B submit ratings and comments; everybody sees "2 of 3 answered" and not who (AC-21); A changes the rating and the count stays 2 (AC-21); F presses "Close survey" and confirms → forms become read-only and the aggregate and comments appear without names (before the close, no results were visible) (AC-11, AC-12, AC-22); reading the Facilitator's `retro.host.*` localStorage record with `page.evaluate` shows that no participant ID or token is stored next to any survey answer (AC-12).
6. **J6 Offline writing** — F's page is closed while A is in the retro write step: A adds an entry and edits another; A still sees both (AC-14); A reloads the page and still sees both; F resumes (Epic 1) → the entries arrive once (A reveals nothing; after F reveals, B sees each of A's entries exactly once) (AC-14, AC-20).
7. **J7 Facilitator removes content** — F deletes an entry, a note item and an action item created by A; they disappear for A and B (AC-16).
8. **J8 Owner leaves** — F removes B from the session (Epic 1) after B was made owner of an action item: the action item still lists "Blake" as plain text (AC-23), and B's check-in response and retro entries are no longer visible to anybody, while B's note items stay.

**Not covered by e2e (unit and component tests cover them):** AC-19 (scale), the details of limits (notes 1,000, actions 280, comments 500).

**Stubbed:** the public PeerJS broker and STUN servers (local signaling server instead); nothing else.
## Decision Log
### Cycle 1
- Q: How can the survey be anonymous in the results and still let participants change their answers? → A: Each device keeps a random answer key in its own participant record; the host stores answers only under that key with no participant ID, and the views send a shuffled list of answers without keys
- Q: How does a participant see their own entries and edits while offline or before the host has confirmed them? → A: Show the unconfirmed intents on top of the last received state, using the same rule functions as the host (in a mode that skips host-only checks), calculated when displaying and never saved into the stored state
- Q: How are per-person changes calculated when a reveal makes many entries visible at once? → A: A generic comparison of the person's previous view and new view down to single items, sending an update only when something differs
- Q: Can a participant write more than one check-in response? → A: One response per participant; writing again edits it
- Q: When do the survey results become visible to the group? → A: After the Facilitator closes the survey; before that the group sees only the count "n of m answered"
- Q: Are the survey ratings required? → A: Both ratings (retro and tool) are required to submit; the comments are optional
- Q: Which contributions are deleted when the Facilitator removes a participant? → A: Nothing is deleted; only their entries (check-in responses and retro entries) are hidden from everybody (chosen instead of the recommended deletion; consequence: the hidden data stays stored on the Facilitator's device until the local data is removed)
- Q: What length limits apply to note items, action item descriptions and survey comments? → A: Note items up to 1,000 characters, action item descriptions up to 280, survey comments up to 500

## Open Questions

None — confidence reached 90%.
