# Spec: Epic 5 — Documentation & Export

Confidence: 93%

PRD: [5_documentation-export.md](5_documentation-export.md)

## Overview
This spec turns the Epic 5 PRD into an implementable design. It covers:

- The document model (plain data) and the builder that creates it from the session state
- Three renderers (Markdown, HTML, CSV), their escaping, and the plain-text version for the clipboard
- Export actions: Markdown download, "Copy for Confluence" (rich text), HTML download, CSV download, with success and failure messages
- How every participant device gets the final documentation when the session ends, and how it is kept until the person leaves
- The documentation screen: warning, preview, export buttons, "completed exports" status, incomplete-note
- Leaving: confirmation when nothing was exported, the browser's close-tab warning, removal of the local data
- The warning for still-hidden entries when the Facilitator ends the session
- Changes to Epic 1 screens and messages that this epic needs (end message payload, ended screen, offline hint action, cleanup)

**Design principle:** the document model is plain JSON-serializable data without HTML, and every renderer is a pure function of it. Participant text is escaped by the renderer of the target format only; nothing is escaped twice. Everything runs on the user's device.

**Dependencies on other epics' specs:**
- **Epic 1:** the end flow (`end` intent, end guards, `ended` message), `EndedPage` placeholder with the `onLeaveDocumentation` hook, local storage records and `removeSession`, the connection banner and its 15-minute hint, the session title (`SessionState.title`), participants and roles.
- **Epic 2:** the chosen format (name, columns, prompts, custom or library) and the time budget.
- **Epic 3:** `isRevealed`, the stops (the end of the session follows Check-out).
- **Epic 4:** `buildContributionSummary(state)` (revealed content only, anonymous survey results, no keys).

## Key Architecture Decisions
| # | Decision | Choice | Rationale | Source |
|---|----------|--------|-----------|--------|
| AD-1 | Stack, tests, UI state, routing | TypeScript, Vite, Preact, Vitest with @testing-library/preact, @preact/signals, own hash router | Fixed by earlier decisions | Epic 1 spec AD-1, AD-9, AD-10, AD-15 |
| AD-2 | One document, three renderers | One document model of plain data; renderers for Markdown, HTML and CSV are pure functions of it; the preview and all exports show the same content | Fixed in the PRD | PRD Q1 (cycle 1), FR-5.2 |
| AD-3 | Final data on every device | When the session ends, every participant device receives the final documentation data and keeps it until the person leaves the documentation screen; if the Facilitator drops out before ending, the documentation is built from what the device holds and marked incomplete | Fixed in the PRD | PRD Q2 (cycle 1), FR-5.9 |
| AD-4 | Rich text copy | Formatted HTML and plain text with the browser's clipboard feature, with a fallback that selects and copies a visible rendered version; success or failure is shown; the HTML file download is always available | Fixed in the PRD | PRD Q3 (cycle 1), FR-5.4 |
| AD-5 | Unrevealed entries | Never part of the documentation; the Facilitator is warned before the session ends and can reveal first | Fixed in the PRD | PRD Q4 (cycle 1), FR-5.11 |
| AD-6 | Local data removal | Only when the person leaves the documentation screen (after at least one export, or after confirming that they want to leave without exporting), never after each export | Fixed in the PRD | PRD Q5 (cycle 1), FR-5.7; Epic 1 FR-1.9 |
| AD-7 | CSV content | One row per item (retro entry, check-in response, note item, action item) with the columns Type, Column (or phase), Text, Author, Owner(s), Due date | Fixed in the PRD | PRD Q6 (cycle 1), FR-5.5 |
| AD-8 | Action items | A table with the columns Action, Owner(s) and Due date in the Markdown and rich text documentation | Fixed in the PRD | PRD Q7 (cycle 1), FR-5.12 |
| AD-9 | Title | Optional session title from session creation; default heading "Retrospective, <date>, <format name>"; used in the heading and in file names | Fixed in the PRD and Epic 1 | PRD Q8 (cycle 1), FR-5.13; Epic 1 FR-1.1 |
| AD-10 | Language and platform | English only; static site, nothing leaves the device; fully usable on mobile | Fixed | PRD NFR-1, NFR-4, NFR-5 |
| AD-11 | How the three renderers are implemented | Hand-written small functions with their own escaping for each format, no extra dependency; the HTML is built directly from the model, not converted from Markdown | The outputs are small and fixed in shape; a dependency adds size and an untrusted-HTML risk without saving real work; pure functions are easy to test | Q1 (cycle 1), architecture advisor |
| AD-12 | How files are downloaded | A temporary link with the `download` attribute pointing to a Blob URL, removed (and the URL revoked after a short delay) after use; a hint next to the buttons says that some phones open the file in a viewer instead of saving it | Works on all current desktop browsers and on Android and iPhone Safari without a permission prompt | Q2 (cycle 1), architecture advisor |
| AD-13 | What the host sends at the end of the session | The finished `DocumentModel` (plain data computed on the Facilitator's device from revealed content only) in the `ended` message; sent again when a participant with an existing, not removed token comes back; each device keeps it in its own storage; joining an ended session as a new participant stays impossible | One computation gives every device an identical document that needs no further contact with the Facilitator; the visibility rules are already enforced on the host | Q3 (cycle 1), architecture advisor |
| AD-14 | Local data when the tab is closed or reloaded | The data stays; it is removed only by the "Done" button or by the automatic removal after 24 hours; the browser's close-tab warning is shown while nothing is exported | A browser cannot tell whether the person confirmed its warning, and a reload must never lose the documentation | Q4 (cycle 1) |
| AD-15 | CSV file details | Comma-separated, UTF-8 without byte order mark, Unix line endings (LF) | The plainest file for the Miro import (chosen instead of the recommended byte order mark and CRLF; Excel may show umlauts wrongly, which the manual check T-12 records) | Q5 (cycle 1) |
| AD-16 | Spreadsheet formulas in CSV cells | A single quote is added in front of any cell whose text starts with `=`, `+`, `-`, `@`, a tab or a carriage return | Common protection; the quote is visible but harmless in Miro | Q6 (cycle 1) |

## Technical Design

### Project structure (additions)
```
src/doc/
  model.ts              DocumentModel and related types, DOC_VERSION
  build.ts              buildDocumentModel(state, options): DocumentModel
  escape.ts             escapeMarkdown, escapeHtml, csvCell (formula protection with a leading quote)
  markdown.ts           renderMarkdown(model): string
  html.ts               renderHtmlFragment(model): string, renderHtmlDocument(model): string
  text.ts               renderPlainText(model): string  (plain-text part of the clipboard)
  csv.ts                renderCsv(model): string  (comma separated, UTF-8 without byte order mark, LF)
  filenames.ts          fileBase(model): string, per-format file names
  download.ts           downloadFile(name, mime, content): Blob URL and a temporary link with the download attribute
  clipboard.ts          copyRichText(model, previewElement): Promise<'clipboard' | 'fallback' | 'failed'>
  finalStore.ts         final record in localStorage + export tracking + removal
  endIntegration.ts     end guard for hidden entries, final payload on `ended`, handling on participants
src/ui/doc/
  DocumentationPage.tsx, DocPreview.tsx, ExportButtons.tsx, ExportStatus.tsx,
  SaveWarning.tsx, IncompleteNote.tsx, LeaveControls.tsx, OpenDocumentationAction.tsx
tests/doc/ ...          unit and component tests
e2e/epic5-documentation.spec.ts
docs/export-check.md    manual check of Confluence paste and Miro import
```

### Data model
```ts
const DOC_VERSION = 1;

interface DocPerson { name: string; role: string; isFacilitator: boolean }   // name = display name

interface DocumentModel {
  version: typeof DOC_VERSION;
  incomplete: boolean;                 // true when built from what a device holds (Facilitator dropped out)
  heading: string;                     // title, or "Retrospective, <date>, <format name>"
  title?: string;                      // the optional session title as entered
  date: string;                        // 'YYYY-MM-DD', local date of session creation
  format: { name: string; custom: boolean; columns: { name: string; prompt?: string }[] };
  timeBudgetMin: number;
  participants: DocPerson[];           // active participants, Facilitator first (removed participants are not listed)
  checkIn: { question: string; responses: { author: string; text: string }[] };
  retro: { columns: { name: string; prompt?: string; entries: { author: string; text: string }[] }[] };
  notes: { noteTaker?: string; items: { text: string; author: string }[] };
  actions: { description: string; owners: string[]; dueDate?: string }[];   // owners as plain names
  survey: {
    answered: number;
    retro: { average: number | null; distribution: [number, number, number, number, number]; comments: string[] };
    tool:  { average: number | null; distribution: [number, number, number, number, number]; comments: string[] };
  };
}
```
`FinalRecord` (localStorage key `retro.final.<sessionId>`, with `schemaVersion` and `savedAt`): `{ model: DocumentModel, exports: { markdown: boolean; rich: boolean; html: boolean; csv: boolean } }`. It is written on the Facilitator's device when the session ends, and on every participant device when the final data arrives; the export marks are updated after each successful export so that a reload keeps them.

### Modules and components

**`doc/build.ts`**: `buildDocumentModel(state: SessionState, options: { incomplete: boolean }): DocumentModel`.
- Takes the contribution data from Epic 4's `buildContributionSummary(state)` (revealed entries only, entries of removed participants left out, survey results anonymous) and adds the session information: heading, date, format, time budget, participants.
- `heading` = the title when present and not blank, else `Retrospective, <date>, <format name>`.
- Works on the host's full state and on a participant's last received view; in both cases it uses only revealed content (`isRevealed`), so a participant's own unrevealed entries are not included either.
- Never contains participant IDs, tokens or survey answer keys (NFR-6).

**`doc/escape.ts`** (pure)
- `escapeMarkdown(text)`: backslash-escapes `\ ` * _ [ ] ( ) # + - . ! | > < ~` where they could be read as syntax (at line start and inside the text), converts line breaks inside table cells and list items to `<br>` or an indented continuation, so participant text always appears as text.
- `escapeHtml(text)`: `& < > " '` to entities; line breaks to `<br>`.
- `csvCell(text)`: wraps in double quotes, doubles inner quotes, keeps line breaks inside quotes, and neutralizes formulas: a cell whose text starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a single quote in front of it (applied to every text cell: Text, Author, Owner(s), Column).

**`doc/markdown.ts`**: `renderMarkdown(model)` produces (GitHub-flavored Markdown): `# <heading>`; a line with date, format and time budget; `## Participants` (list of "name (role)", Facilitator marked); `## Check-in` (the question, then a list of "author: text"); `## Retrospective` with `### <column>` (and the prompt in italics) and bullet lists "text (author)"; `## Discussion notes` (note taker line, bullet list); `## Action items` as a table with the columns `Action | Owner(s) | Due date` (owners joined by ", ", empty due date as "–"); `## Check-out` (answers count, per question: average with one decimal, distribution, comments). A note "Incomplete: the Facilitator left before the session was ended" is added at the top when `incomplete`.

**`doc/html.ts`**: `renderHtmlFragment(model)` builds semantic HTML directly from the model (not from Markdown): `h1`, `h2`, `h3`, `p`, `ul/li`, `table/thead/tbody/tr/th/td`, `em`; no classes, no scripts, no external resources, only a few inline-free tags so that Confluence keeps the structure. `renderHtmlDocument(model)` wraps the fragment in `<!doctype html><html lang="en"><meta charset="utf-8"><title>…</title>` with a small embedded stylesheet for readability.

**`doc/text.ts`**: `renderPlainText(model)`: the plain text that accompanies the HTML in the clipboard (same as the Markdown without escaping marks).

**`doc/csv.ts`**: `renderCsv(model)`: the header `Type,Column,Text,Author,Owner(s),Due date` and one row per item in this order: check-in responses (`Type` = "Check-in", `Column` = "Check-in"), retro entries (`Type` = "Retro entry", `Column` = the column name), note items ("Note", "Discussion notes"), action items ("Action item", "Action items", the description as `Text`, owners joined by ", ", due date). Check-out results are not items and are not part of the CSV. The file is comma-separated, encoded as UTF-8 without a byte order mark, with LF line endings (line breaks inside quoted cells are kept as LF).

**`doc/filenames.ts`**: `fileBase(model)` = `<slug(title or format name)>-<date>`, where the slug is lower case, accents removed, anything other than letters and digits replaced by `-`, at most 60 characters; files are `<fileBase>.md`, `<fileBase>.html`, `<fileBase>.csv`.

**`doc/download.ts`**: `downloadFile(name, mime, content)` creates a `Blob` with the given MIME type (for text types with `charset=utf-8`), a temporary object URL and a hidden link with the `download` attribute, clicks it, removes the link, and revokes the URL after a short delay; it returns when the download was triggered.

**`doc/clipboard.ts`**: `copyRichText(model, previewElement)`: tries the browser's clipboard feature with a `ClipboardItem` holding `text/html` (the HTML fragment) and `text/plain`; if that is not available or is rejected, it selects the visible preview element and copies it with the legacy copy command; returns `'clipboard'`, `'fallback'` or `'failed'` so the UI can show success or failure. Needs a secure context (GitHub Pages is HTTPS) and a user gesture (a button click).

**`doc/finalStore.ts`**: `saveFinal(sessionId, model)`, `loadFinal(sessionId)`, `markExported(sessionId, kind)`, `removeFinal(sessionId)`; registered into Epic 1's `storage.removeSession` so that leaving removes `retro.final.<sessionId>` as well; covered by the 24-hour expiry sweep (the record is added to `retro.index`).

**`doc/endIntegration.ts`**
- `hiddenEntriesGuard`: registered with Epic 1's `registerEndGuard`; counts entries that are not revealed (excluding entries of removed participants) and returns the message "N entries are still hidden and will not be in the documentation. Cancel and use Reveal first, or end the session anyway." (nothing when N is 0). The Facilitator can cancel the dialog and reveal (Epic 3), or end anyway (AC-19).
- `endPayload(state)`: called by the host when it sends `ended`; returns `{ final: buildDocumentModel(state, { incomplete: false }) }`, which is the same for every participant, in the `ended` message (AD-13).
- On a participant device: when `ended` with a final model arrives, `saveFinal` and navigate to the documentation page.
- On a later `rejoin` (existing, not removed token) to an ended session the host answers with `ended` and the final model again, so a participant who was offline at the end still gets it; `join` of new participants into an ended session stays rejected (Epic 1 AC-4).
- The host keeps listening while the Facilitator is on the documentation screen.

**UI**
- `DocumentationPage` replaces Epic 1's `EndedPage`: `SaveWarning` (prominent, always visible at the top: "This session is not saved. Save or download the documentation to your device before you leave."), `IncompleteNote` when `model.incomplete`, `DocPreview`, `ExportButtons`, `ExportStatus`, `LeaveControls`.
- `DocPreview` renders the model with Preact components (not by injecting an HTML string), with the same structure as the HTML export; a test compares its text content with that of the exported fragment.
- `ExportButtons`: "Download Markdown", "Copy for Confluence", "Download HTML", "Download CSV for Miro" with a short hint for each (for example "Paste into a Confluence page" and "Import into a Miro board") and, next to downloads, a hint that on some phones the file opens in a viewer instead of being saved. After an action the button shows success or failure in a live region (accessible).
- `ExportStatus`: a list "Markdown ✓ · Copied for Confluence ✓ · HTML ✓ · CSV ✓" from `FinalRecord.exports`.
- `LeaveControls`: "Done: remove this session from this device"; if no export is marked, a confirmation dialog repeats the warning ("You have not exported anything. The documentation will be lost."); on confirm (or when at least one export is marked) `removeSession(sessionId)` and `removeFinal` run and the app goes to the home screen (AC-14). The browser's close-tab warning and the in-app route guard are described under Key flows.
- `OpenDocumentationAction`: an additional button "Open documentation (may be incomplete)" in Epic 1's connection banner when the 15-minute Facilitator-offline hint is shown; it builds the model with `incomplete: true` from the device's last state and opens the documentation page.
- Mobile-first; texts in `texts.ts`; all buttons have accessible names.

### Interfaces
- **Epic 1 (changes this epic needs):**
  1. The `ended` host-to-client message gets an optional payload from a registry `registerEndPayload(fn)`; the host also re-sends `ended` with the payload on a `rejoin` of an existing, not removed participant to an ended session (joining as a new participant stays rejected).
  2. `EndedPage` is replaced by `DocumentationPage`; its `onLeaveDocumentation` hook calls `removeSession`.
  3. `storage.removeSession` also removes `retro.final.<sessionId>`.
  4. The connection banner accepts extra actions through a small registry (`registerOfflineHintAction`).
- **Epic 3:** the route to the documentation after the Check-out stop is Epic 1's `#/ended`.
- **Epic 4:** `buildContributionSummary(state)`.

### Key flows

**Journey 1: Facilitator ends the session and sees the documentation.** The Facilitator chooses "End session" (Epic 1) → end guards run; `hiddenEntriesGuard` shows its message when entries are still hidden and the Facilitator cancels (to reveal) or ends anyway → `end` → the host builds `final` and sends `ended` with it to every participant → every device stores the `FinalRecord` and shows `DocumentationPage` with the warning, the preview and the export buttons.

**Journey 2: Exporting in several formats.** Markdown: `renderMarkdown` → `downloadFile(<fileBase>.md, 'text/markdown', …)` → `markExported('markdown')`. Confluence: `copyRichText` → success or fallback message → `markExported('rich')`. HTML: `renderHtmlDocument` → download → `markExported('html')`. CSV: `renderCsv` → download → `markExported('csv')`. After every export the status list updates; the other formats can still be exported.

**Journey 3: Leaving without exporting.** Leaving through "Done" with no export marked shows the confirmation; confirming removes the local data. Closing or reloading the tab triggers the browser's own "leave site?" warning while no export is marked (a browser-controlled message that cannot be customized); the local data stays in that case (a reload keeps the documentation; leftover data is removed by the 24-hour expiry, AD-14). The in-app route guard asks for confirmation when the hash changes away from the documentation page before any export.

**Journey 4: Participant exports on their own device.** A participant's device stores the final model on `ended`; the documentation page works from the stored record, so exports work after a reload and while the Facilitator is offline; a participant who was offline at the end gets the model on their next rejoin.

**Journey 5: Facilitator drops out before the session ends.** After 15 minutes of Facilitator-offline, the banner hint offers "Open documentation (may be incomplete)" → the device builds the model from its last received state with `incomplete: true` → the page shows `IncompleteNote` ("Some content may be missing because the Facilitator left before the session was ended.") and the same export buttons.

**Journey 6: Session title.** The title entered at session creation (Epic 1) is in the state; `build.ts` uses it for the heading and `filenames.ts` for the file names; without it the default heading and the format name are used.

## Implementation Tasks

Tasks are ordered; T-1 first; T-2 to T-5 can run in parallel after T-1; T-6 needs T-1; T-7 needs T-1 and T-6; T-8 and T-9 need T-2 to T-7; T-10 needs T-7 and the Epic 1 implementation.

### T-1: Document model and builder
- **Satisfies:** FR-5.1, FR-5.11, FR-5.13; NFR-6; AC-1, AC-2, AC-3, AC-19, AC-21
- **Depends on:** none (uses Epic 4's `buildContributionSummary`; a stub with the same shape is used until Epic 4 exists)
- **Tests first (TDD):**
  - `tests/doc/build.test.ts`: a complete sample state produces a model with the heading, date, format, time budget, participants and roles (Facilitator first, removed participants not listed), check-in question and responses with author names, retro entries per column with author names, note items with the note taker, action items with owners as names and due dates, and the survey results (answered count, average with one decimal, distribution, comments without names); a title entered at creation becomes the heading; without a title the heading is `Retrospective, 2026-03-01, Start-Stop-Continue`; a custom format lists its own columns and `custom: true`; unrevealed entries are not in the model (also a participant's own unrevealed entries when built from a participant's view); entries of removed participants are not in the model; the model JSON contains no participant IDs, tokens or survey answer keys (a scan for every ID and key of the sample state); `incomplete` is set from the option; with no contributions every list is empty and averages are `null`.
  - `tests/doc/build.date.test.ts`: the date is the local date of `createdAt` as `YYYY-MM-DD` (tested with a fixed time zone).
- **Implementation:** `doc/model.ts`, `doc/build.ts`.
- **Done when:** tests pass.

### T-2: Escaping and Markdown renderer
- **Satisfies:** FR-5.3, FR-5.10, FR-5.12; AC-5, AC-18, AC-20
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/doc/escape.markdown.test.ts`: text containing `*bold*`, `_x_`, `# heading`, `- item`, `1. item`, `[link](url)`, `<b>`, `|`, backticks, `\` and `>` is shown as literal text when the output is parsed with a Markdown parser (test-only dependency or a small reference check of the escaped string); line breaks inside a table cell become `<br>`; a very long text and emoji are unchanged.
  - `tests/doc/markdown.test.ts`: the rendering of the sample model matches a stored snapshot; the action items are a table with the header `Action | Owner(s) | Due date`, several owners joined by ", ", a missing due date shown as "–"; the heading and the participants list are present; `incomplete` adds the note at the top; entries with special characters do not break headings, lists or the table; an empty model renders without errors and without empty tables.
- **Implementation:** `doc/escape.ts` (`escapeMarkdown`), `doc/markdown.ts`.
- **Done when:** tests pass.

### T-3: HTML renderers and plain text
- **Satisfies:** FR-5.4, FR-5.10, FR-5.12; AC-6 (content), AC-8, AC-18, AC-20
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/doc/escape.html.test.ts`: `<script>alert(1)</script>`, `"quotes"`, `&amp;`, `'` and line breaks are shown as text (parsing the fragment with the DOM and reading `textContent` returns the original text, and no `script` element exists).
  - `tests/doc/html.test.ts`: the fragment contains `h1`, `h2`, `h3`, `ul`, `table` with `thead` and `tbody` for action items, and no `class`, `style`, `script` or external URL attribute; the document version has the doctype, `lang="en"`, `meta charset`, a `title` equal to the heading and an embedded stylesheet; the text content of the fragment equals the text content of the preview component (parity with the preview, AC-4); `incomplete` adds the note.
  - `tests/doc/text.test.ts`: the plain text contains the same sections and no Markdown escape characters or HTML.
- **Implementation:** `doc/escape.ts` (`escapeHtml`), `doc/html.ts`, `doc/text.ts`.
- **Done when:** tests pass.

### T-4: CSV renderer
- **Satisfies:** FR-5.5, FR-5.10; AC-9, AC-10, AC-18
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/doc/csv.test.ts`: the header is exactly `Type,Column,Text,Author,Owner(s),Due date` (comma-separated); rows appear in the order check-in responses, retro entries, notes, action items, with the `Type` and `Column` values from the design; action rows have the description as `Text`, owners joined by ", " and the due date; check-out results are not in the file; a text with commas, quotes (doubled) and line breaks is one cell and parsing the file with a CSV parser returns the original text; a text starting with `=`, `+`, `-` or `@` gets a single quote in front of it and the parsed cell differs from the original only by that quote (also for `\t=1`, a lone `-` and `@user`); text that merely contains these characters later is unchanged; negative-looking text such as `-5` is protected as well; empty values are empty cells; the file is UTF-8 without a byte order mark (the first bytes are not `EF BB BF`), uses LF line endings, and umlauts and emoji survive a round trip.
- **Implementation:** `doc/escape.ts` (`csvCell`), `doc/csv.ts`.
- **Done when:** tests pass.

### T-5: File names, download and clipboard helpers
- **Satisfies:** FR-5.3, FR-5.4; AC-5, AC-6, AC-7, AC-8, AC-9, AC-21
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/doc/filenames.test.ts`: `Team Alpha: Q1 retro!` and `2026-03-01` become `team-alpha-q1-retro-2026-03-01`; accents are removed; an empty slug falls back to the format name; the slug is at most 60 characters; the three extensions are `.md`, `.html`, `.csv`.
  - `tests/doc/download.test.ts`: `downloadFile` creates a download of the given name, MIME type and content through a Blob, a temporary object URL and a link with the `download` attribute, and cleans up its temporary resources (link removed, URL revoked after a short delay); the content is exactly the string passed in; for CSV no byte order mark is added.
  - `tests/doc/clipboard.test.ts`: with the clipboard feature available, `ClipboardItem` is written with `text/html` and `text/plain` and the result is `'clipboard'`; when the feature is missing or rejects, the preview element is selected and the legacy copy command is used and the result is `'fallback'`; when both fail the result is `'failed'`; nothing is sent over the network.
- **Implementation:** `doc/filenames.ts`, `doc/download.ts`, `doc/clipboard.ts`.
- **Done when:** tests pass.

### T-6: Final record storage and export tracking
- **Satisfies:** FR-5.7, FR-5.9; AC-13, AC-14, AC-16
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/doc/finalStore.test.ts`: `saveFinal` then `loadFinal` returns the same model and no export marks; `markExported` sets one mark and keeps the others; marks survive a reload (new store instance on the same storage); `removeFinal` deletes the record; `storage.removeSession` deletes `retro.final.<id>`; a record with an unknown `schemaVersion` is ignored; the 24-hour sweep removes an old final record; a throwing `localStorage` does not crash (the page then keeps the model in memory and shows a note that a reload would lose it).
- **Implementation:** `doc/finalStore.ts`; registration of the removal in Epic 1's storage.
- **Done when:** tests pass.

### T-7: End integration (guard, final payload, participant handling)
- **Satisfies:** FR-5.9, FR-5.11; AC-16, AC-17, AC-19; NFR-6
- **Depends on:** T-1, T-6 and the Epic 1 implementation
- **Tests first (TDD):**
  - `tests/doc/endGuard.test.ts`: with 3 unrevealed entries (one of them by a removed participant) the guard message names 2; with none there is no message; the dialog keeps "End session anyway" available; after ending, the model does not contain those entries (AC-19).
  - `tests/doc/endFlow.test.ts`: with the real host and clients on the memory transport: when the Facilitator ends the session every connected participant receives `ended` with the model and stores it; the models are identical on all devices and contain no unrevealed entries; after the host stops, every participant can still load the stored model (AC-16); a participant who was offline at the end and rejoins with their existing token later gets `ended` and the model; a new participant who joins an ended session is still rejected; a removed participant's rejoin is rejected.
  - `tests/doc/incomplete.test.ts`: when the Facilitator never ended the session, a participant's device builds the model from its last state with `incomplete: true` and the note is shown; the model contains only revealed content (AC-17).
- **Implementation:** `doc/endIntegration.ts` and the Epic 1 changes (end payload registry, re-send on rejoin).
- **Done when:** tests pass.

### T-8: Documentation screen and exports
- **Satisfies:** FR-5.1 to FR-5.5, FR-5.6, FR-5.7, FR-5.8, FR-5.12; NFR-3, NFR-4; AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-13, AC-15, AC-20
- **Depends on:** T-2 to T-7
- **Tests first (TDD):**
  - `tests/ui/doc.page.test.tsx`: the page shows the save warning at the top, the preview and four export buttons; a participant who is not the Facilitator sees the same page and buttons (AC-15); with `incomplete` the note is shown; the action items are a table in the preview (AC-20).
  - `tests/ui/doc.preview.test.tsx`: the text content of the preview equals the text content of `renderHtmlFragment` for the sample model (AC-4); special characters appear as text.
  - `tests/ui/doc.exports.test.tsx`: each button calls the matching renderer and download helper with the expected file name and MIME type and then marks the export; "Copy for Confluence" shows "Copied" for the clipboard path, a note for the fallback path and an error with the HTML download suggested when it fails (AC-6, AC-7); after an export the status list shows the mark and the other buttons stay enabled (AC-13); the page works from a stored `FinalRecord` after a reload.
  - `tests/ui/doc.mobile.test.tsx`: at 360 px width the buttons are stacked and reachable; the download hint is shown.
- **Implementation:** `DocumentationPage`, `DocPreview`, `ExportButtons`, `ExportStatus`, `SaveWarning`, `IncompleteNote`, texts.
- **Done when:** tests pass.

### T-9: Leave controls and warnings
- **Satisfies:** FR-5.6, FR-5.7; AC-11, AC-12, AC-14
- **Depends on:** T-6, T-8
- **Tests first (TDD):**
  - `tests/ui/doc.leave.test.tsx`: "Done" without any export shows the confirmation with the warning; cancelling keeps the page and the data; confirming removes the session data (`removeSession` and `removeFinal`) and goes home; "Done" after at least one export removes the data without the extra warning (a plain confirmation line is still shown); an export alone never removes data (AC-14); changing the hash away from the page before any export asks for confirmation.
  - `tests/ui/doc.unload.test.tsx`: while no export is marked the page registers a `beforeunload` handler that asks the browser to show its warning (AC-12); after the first export the handler is removed; the handler is removed when the page unmounts; closing or reloading the tab never removes the local data (a reload shows the same documentation again).
- **Implementation:** `LeaveControls`, the unload handler and route guard.
- **Done when:** tests pass.

### T-10: Epic 1 integration (ended page, offline hint action, cleanup)
- **Satisfies:** FR-5.9; AC-16, AC-17
- **Depends on:** T-7 to T-9 and the Epic 1 implementation
- **Tests first (TDD):**
  - `tests/doc/integration.test.tsx`: with the real Epic 1 app on the memory transport: ending the session shows `DocumentationPage` on all devices; the offline hint in the banner shows "Open documentation (may be incomplete)" after 15 minutes (fake timers) and opens the page with the incomplete note; `Epic 1`'s `EndedPage` placeholder is no longer reachable; the 24-hour sweep removes a final record that was never left.
- **Implementation:** replace `EndedPage`, register the banner action, wire `onLeaveDocumentation`.
- **Done when:** tests pass; a complete session can be run, ended and exported.

### T-11: Privacy and performance checks
- **Satisfies:** NFR-1, NFR-2; AC-22, AC-23
- **Depends on:** T-8
- **Tests first (TDD):**
  - `tests/doc/privacy.test.ts`: generating the model, rendering all formats, and running every export action in the component test produce no `fetch` or `XMLHttpRequest` call and no `navigator.sendBeacon`.
  - `tests/doc/performance.test.ts`: a model for 8 participants with 400 retro entries, 40 notes and 20 action items renders to Markdown, HTML and CSV in well under one second each on the test machine (the test uses a generous limit, for example 2 seconds in total).
- **Implementation:** fix any violation found; no new feature.
- **Done when:** tests pass.

### T-12: Manual check of Confluence paste and Miro import
- **Satisfies:** NFR-3
- **Depends on:** T-8
- **Tests first (TDD):** Not applicable (manual). Deliverable: `docs/export-check.md` with the results of (1) pasting "Copy for Confluence" into a Confluence page (headings, lists, the action item table, special characters) and (2) importing the CSV into a Miro board (how the columns are mapped, whether each row becomes its own item, how the encoding and the formula protection look) and (3) opening the CSV in Excel to record how umlauts and the leading quotes appear (the file has no byte order mark), with screenshots or notes and the changes made as a result.
- **Implementation:** adjust the renderers (for example the CSV header or the fragment tags) if the check shows that a paste or import needs rework; the result must satisfy "without manual rework".
- **Done when:** the document exists and the renderers match its findings.

## Traceability
| AC | Tasks | Tests |
|----|-------|-------|
| AC-1 | T-1 | build, e2e J1 |
| AC-2 | T-1 | build, e2e J1 |
| AC-3 | T-1 | build, e2e J1 |
| AC-4 | T-3, T-8 | html (parity), ui/doc.preview, e2e J1 |
| AC-5 | T-2, T-5, T-8 | markdown, filenames, download, ui/doc.exports, e2e J2 |
| AC-6 | T-3, T-5, T-8 | html, clipboard, ui/doc.exports, e2e J2, manual check (T-12) |
| AC-7 | T-5, T-8 | clipboard, ui/doc.exports, e2e J2 (fallback variant) |
| AC-8 | T-3, T-5, T-8 | html, download, ui/doc.exports, e2e J2 |
| AC-9 | T-4, T-5, T-8 | csv, download, ui/doc.exports, e2e J2, manual check (T-12) |
| AC-10 | T-4 | csv |
| AC-11 | T-8 | ui/doc.page, e2e J1 |
| AC-12 | T-9 | ui/doc.unload, e2e J3 |
| AC-13 | T-6, T-8 | finalStore, ui/doc.exports, e2e J2 |
| AC-14 | T-6, T-9 | finalStore, ui/doc.leave, e2e J2, e2e J3 |
| AC-15 | T-8 | ui/doc.page, e2e J4 |
| AC-16 | T-6, T-7, T-10 | finalStore, endFlow, integration, e2e J4 |
| AC-17 | T-7, T-10 | incomplete, integration, e2e J5 |
| AC-18 | T-2, T-3, T-4 | escape.markdown, escape.html, csv, e2e J2 |
| AC-19 | T-1, T-7 | build, endGuard, e2e J1 |
| AC-20 | T-2, T-3, T-8 | markdown, html, ui/doc.page, e2e J1 |
| AC-21 | T-1, T-5 | build, filenames, e2e J6 |
| AC-22 | T-11 | privacy, e2e Privacy |
| AC-23 | T-11 | performance |

| FR / NFR | Tasks |
|----------|-------|
| FR-5.1 | T-1, T-8 |
| FR-5.2 | T-3, T-8 |
| FR-5.3 | T-2, T-5, T-8 |
| FR-5.4 | T-3, T-5, T-8 |
| FR-5.5 | T-4, T-5, T-8 |
| FR-5.6 | T-8, T-9 |
| FR-5.7 | T-6, T-8, T-9 |
| FR-5.8 | T-8 |
| FR-5.9 | T-6, T-7, T-10 |
| FR-5.10 | T-2, T-3, T-4 |
| FR-5.11 | T-1, T-7 |
| FR-5.12 | T-2, T-3, T-8 |
| FR-5.13 | T-1, T-5 |
| NFR-1 | T-11 |
| NFR-2 | T-11 |
| NFR-3 | T-12 |
| NFR-4 | T-8 |
| NFR-5 | T-8 (all texts in English) |
| NFR-6 | T-1, T-7 |

## E2E Test (Playwright)
The implement-epic skill builds and sets up this test later; this spec only describes it.

**File:** `e2e/epic5-documentation.spec.ts`. One test per PRD journey, plus a privacy test. Participants are simulated with browser contexts (Facilitator F "Fiona", participants A "Alex" and B "Blake"), reusing the helpers of the Epic 1, 3 and 4 e2e tests (create, join, start, move through the flow, add entries, reveal). The real contributions module is used.

**How the app starts:** the same two web servers as the Epic 1 e2e test: the local signaling server (`peer` package) and the e2e build served by `vite preview`, built with `.env.e2e`. A helper `runSession(options)` prepares a finished session: format "Start-Stop-Continue" with 50 minutes, session title "Team Alpha" (or none), A and B add check-in responses and retro entries (including entries with special characters such as `*bold*`, `<b>x</b>`, `=SUM(A1)` and a comma and a quote), F reveals, notes and one action item with two owners and a due date are added, A and B submit the survey, F closes it. Downloads are captured with Playwright's `page.waitForEvent('download')`; clipboard content is read with a granted `clipboard-read` permission and `navigator.clipboard.read()`.

**Tests:**
1. **J1 End and documentation** — in a first run every entry has been revealed, F presses "End session" and confirms; all three devices show the documentation page with the prominent warning (AC-11), the preview with the heading "Team Alpha" (or "Retrospective, <date>, Start-Stop-Continue" in the variant without title) (AC-21), the sections, participants with roles, entries with author names, notes, the action item as a table with owners and due date (AC-20), and survey results without names (AC-1, AC-2, AC-3). In a second run B has written an entry that was never revealed (the Facilitator skipped Reveal): when F presses "End session" the dialog says that 1 entry is still hidden and will not be in the documentation; F first cancels, uses Reveal and ends, and the entry is in the documentation; in a third run F ends anyway, and the documentation does not contain the hidden entry (AC-19). The preview text equals the downloaded HTML text (AC-4).
2. **J2 Exporting in several formats** — A downloads Markdown: the file name is `team-alpha-<date>.md` and the content contains the special-character entries as literal text (AC-5, AC-18); A clicks "Copy for Confluence": the clipboard holds `text/html` containing a `table` and `text/plain` (AC-6); with the clipboard permission removed, the fallback message appears and copy still succeeds (AC-7); A downloads HTML: file opens in a new page without script execution (AC-8, AC-18); A downloads CSV: parsed rows have the columns `Type, Column, Text, Author, Owner(s), Due date`, one row per item, the `=SUM(A1)` cell is protected (AC-9, AC-10, AC-18); the status list shows four marks (AC-13); after the first export the other buttons still work and the session data is still on the device (AC-14).
3. **J3 Leaving without exporting** — B tries to close the page with a `beforeunload` dialog expected (AC-12); B clicks "Done" and sees the confirmation with the warning; confirming returns to the home screen and `retro.participant.*` and `retro.final.*` are gone from localStorage (AC-14); B reloads the page before using "Done" and still sees the documentation, because closing or reloading never removes the data (AD-14).
4. **J4 Participant exports on their own device** — F closes its page after ending; A and B still see the documentation page, reload it, and can export all formats (AC-15, AC-16); a participant context C that was offline when the session ended is brought back with its stored token and then receives the documentation (AC-16); a brand-new context cannot join the ended session (Epic 1 AC-4).
5. **J5 Facilitator drops out before the session ends** — F closes its page mid-session; after the clock is advanced by 15 minutes A's banner shows "Open documentation (may be incomplete)"; clicking it opens the page with the incomplete note and only revealed content (AC-17).
6. **J6 Session title** — a session without a title shows the heading "Retrospective, <date>, Start-Stop-Continue" and files named `start-stop-continue-<date>.*`; with the title "Team Alpha: Q1 retro!" the files are named `team-alpha-q1-retro-<date>.*` (AC-21).
7. **Privacy** — during J1 and J2 all recorded requests go only to the app's own origin and the local signaling server (AC-22).

**Not covered by e2e (unit and component tests cover them):** AC-10 details, AC-23 (performance), the iOS download hint, escaping details of every special character.

**Stubbed:** the public PeerJS broker and STUN servers (local signaling server instead); the real Confluence and Miro (covered by the manual check T-12).
## Decision Log
### Cycle 1
- Q: How are the three renderers (Markdown, HTML, CSV) implemented? → A: Hand-written small functions with their own escaping for each format, no extra dependency; the HTML is built directly from the model
- Q: How are files downloaded on desktop and mobile browsers? → A: A temporary link with the download attribute pointing to the file content, removed after use
- Q: What does the Facilitator's device send at the end of the session so that every participant can export even if the Facilitator goes offline afterwards? → A: The finished documentation data in the "ended" message, sent again when a participant with an existing token comes back; each device keeps it in its own storage
- Q: What happens to the locally kept session data when someone closes or reloads the tab on the documentation screen without having used the "Done" button? → A: The data stays; it is removed only by the "Done" button or by the automatic removal after 24 hours; the browser's close-tab warning is shown while nothing is exported
- Q: What are the details of the CSV file? → A: Comma-separated, UTF-8 without byte order mark and Unix line endings (chosen instead of the recommended byte order mark and Windows line endings; Excel may show umlauts wrongly, recorded in the manual check)
- Q: How are spreadsheet formulas in CSV cells neutralized? → A: A single quote is added in front of such a cell

## Open Questions

None — confidence reached 90%.
