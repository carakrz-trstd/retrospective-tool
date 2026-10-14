# Spec: Epic 2 — Format Recommendation & Library

Confidence: 93%

PRD: [2_format-recommendation-library.md](2_format-recommendation-library.md)

## Overview
This spec turns the Epic 2 PRD into an implementable design. It covers:

- The questionnaire and its answers
- The format definition (one shared definition used by the library and by custom formats) and its validation
- The 12 library format data files, generic defaults (time split, check-in questions) and how they are loaded
- The recommendation (a generic scorer with a hard time filter and a weak-match flag)
- The custom format logic (from scratch, "Use as basis", 2 to 4 columns, the over-4 rule)
- The screens: questionnaire, recommendation, library, format details, custom format form
- The hand-over of the chosen format and time budget to session creation (Epic 1)

**Design principle:** all rules (format definition, validation, scoring, custom format editing) are plain TypeScript functions without UI or storage, so they are testable on their own. Nothing from this epic is stored on the device or sent anywhere (NFR-6); the flow state lives in memory only.

**Dependencies on other epics' specs:** none for the logic. The hand-over (T-11) touches Epic 1's session creation (`FormatRef` becomes `Format`, the create page receives the chosen format). Until Epic 1 exists, this epic ends the flow in a small "chosen format" screen that Epic 1's create page replaces. The stack and conventions come from the Epic 1 spec: TypeScript, Vite, Preact, Vitest with @testing-library/preact, @preact/signals for UI state, the own hash router, English texts in one `texts.ts`.

**What the other epics read from this one:** Epic 1 (`Format`, `ChosenFormat`), Epic 3 (`Format.timeSplits`, `facilitationTips`, `checkInQuestion`, phase IDs), Epic 4 (`Format.columns`, `checkInQuestion`), Epic 5 (the chosen format including the columns of a custom format).

## Key Architecture Decisions
| # | Decision | Choice | Rationale | Source |
|---|----------|--------|-----------|--------|
| AD-1 | Stack, build, tests, UI state, routing | TypeScript + Vite + Preact; Vitest with @testing-library/preact; @preact/signals; own hash router | Fixed by earlier decisions | Epic 1 spec AD-1, AD-9, AD-10, AD-15 |
| AD-2 | Library storage | JSON data files in the repository, one file per format, bundled at build time, edited via pull request | Fixed in the PRD | PRD Q1 (cycle 1), FR-2.7 |
| AD-3 | Recommendation method | Declarative scoring from weights in the format data with one generic scorer; the chosen time budget is a hard filter against each format's supported durations | Fixed in the PRD | PRD Q2 (cycle 1), FR-2.2 |
| AD-4 | Weak match | Best matches are always shown; a weak match is marked with a note and the library and "Create custom format" are offered | Fixed in the PRD | PRD Q9 (cycle 2), AC-20 |
| AD-5 | Custom formats | Exist only in memory for the session being created (no storage); 2 to 4 columns; a copy of a library format with more than 4 columns keeps them and can only lose columns | Fixed in the PRD | PRD Q6 (cycle 1), Q10 (cycle 2), Q11 (cycle 3) |
| AD-6 | Time splits | Each format has a split for each supported total time (30 / 50 / 80) covering the six phases and the three retro steps; custom formats use a generic default split; each split sums exactly to the total | Fixed in the PRD | PRD Q7 (cycle 1), AC-7, AC-15 |
| AD-7 | Check-in question | Each library format suggests one; custom formats choose from a short list of generic ones | Fixed in the PRD | PRD Q8 (cycle 1) |
| AD-8 | Format validation | A Zod schema (Zod 4 / mini build to keep the bundle small) that also provides the TypeScript types; it runs in the tests and in the custom format form; the custom-format rules are a separate check on top of it | One shared definition, derived types and readable errors, so data test, form and hand-over cannot drift apart | Q1 (cycle 1), architecture advisor |
| AD-9 | How library files are loaded | Vite's glob import with eager loading of the `data/library` folder | Dropping a JSON file into the folder is the whole change (AC-16); still bundled at build time | Q2 (cycle 1), architecture advisor |
| AD-10 | Where the scoring constants live | A small data file `data/scoring.json` next to the formats (outside the library folder), checked with the same schema approach | The constants apply to all formats; retuning is a data change only | Q3 (cycle 1), architecture advisor |
| AD-11 | Time budget when a format is chosen without the questionnaire | A short "How much time do you have?" step with three choices, showing only the durations the chosen format supports (a custom format supports all three) | Keeps the time budget required without forcing the whole questionnaire | Q4 (cycle 1) |
| AD-12 | Attribution display for funretrospectives.com | "Based on <format name> on funretrospectives.com" with a link on every library format's details page, plus one line in the app's footer; the wording is finalized after the licence check (T-12) | Visible credit next to the content, wording changeable without code changes | Q5 (cycle 1) |
| AD-13 | Limits for custom column names and prompts | Column names at most 30 characters and unique within the format (ignoring upper/lower case); prompts at most 120 characters | Readable on a phone; no two columns with the same name on the board | Q6 (cycle 1) |

## Technical Design

### Project structure (additions to the Epic 1 structure)
```
src/formats/
  types.ts                  Format, Column, TimeSplit, Answers, ChosenFormat, phase IDs
  questionnaire.ts          the 5 questions with IDs, labels and options
  schema.ts                 the Zod schemas (formatSchema, scoringConfigSchema, defaultsSchema) and the derived TypeScript types
  validate.ts               validateFormat(), validateCustomFormat()
  library.ts                loads (Vite eager glob of data/library/*.json) and exposes the library; getFormat(id), listFormats()
  scoring.ts                recommend(answers, formats, config)
  custom.ts                 createCustomFromScratch(), createCustomFromLibrary(), addColumn(), removeColumn(), moveColumn(), setCheckIn(), validateCustom()
  data/
    library/*.json         12 format files (one per format)
    defaults.json          generic default time splits and the generic check-in questions
    scoring.json           scoring constants (outside the library folder so the glob does not load it)
src/ui/format/
  flow.ts                  in-memory flow state (signals): answers, recommendation, chosen format
  QuestionnairePage.tsx, RecommendationPage.tsx, LibraryPage.tsx, FormatDetailsPage.tsx, CustomFormatPage.tsx, TimeBudgetStep.tsx
tests/formats/ ...         unit and component tests
e2e/epic2-format-selection.spec.ts
```

### Data model
```ts
type Mood = 'energized' | 'neutral' | 'tired' | 'tense';
type Goal = 'fun' | 'bond' | 'reflect-period' | 'reflect-project';
type Depth = 'lean' | 'extensive';
type Setting = 'in-room' | 'remote';
type TimeBudget = 30 | 50 | 80;

interface Answers { mood: Mood; goal: Goal; timeBudgetMin: TimeBudget; depth: Depth; setting: Setting }

interface Column { id: string; name: string; prompt?: string }

interface TimeSplit {                      // minutes; the sum of all values equals the total time
  checkIn: number;
  reviewActions: number;
  retro: { write: number; reveal: number; discuss: number };
  notes: number;
  actions: number;
  checkOut: number;
}

interface Format {
  id: string;                              // kebab-case, unique; custom formats use "custom-<random>"
  name: string;
  description: string;
  source?: { name: string; url: string };  // attribution for library formats (NFR-3), shown on the details page (AD-12)
  columns: Column[];                       // library: 2-5 columns; custom: 2-4 (rule in custom.ts)
  timeSplits: Partial<Record<TimeBudget, TimeSplit>>;   // supported durations = the keys present
  fit: {                                   // weights 0 (poor) to 3 (very good)
    mood: Record<Mood, number>;
    goal: Record<Goal, number>;
    depth: Record<Depth, number>;
    setting: Record<Setting, number>;
  };
  reasons?: { mood?: Partial<Record<Mood, string>>; goal?: Partial<Record<Goal, string>> };  // optional "why it fits" texts
  checkInQuestion: string;
  facilitationTips: string[];              // at least 2
  custom?: true;                           // set only for custom formats
}

interface ChosenFormat { format: Format; timeBudgetMin: TimeBudget; answers?: Answers }
```
Phase IDs for Epic 3 are exported as constants: `PHASES = ['checkIn', 'reviewActions', 'retro', 'notes', 'actions', 'checkOut']` and `RETRO_STEPS = ['write', 'reveal', 'discuss']`.

Tags shown on library cards are derived: for each dimension, the options with a weight of 2 or more (for example "tense, tired · reflect on the period · lean · remote OK") plus the supported durations.

`defaults.json` contains the generic default `TimeSplit` for 30, 50 and 80 minutes and the list of generic check-in questions (at least 5). Default splits (minutes): 
- 30: checkIn 3, reviewActions 3, retro 5 / 3 / 8, notes 2, actions 4, checkOut 2
- 50: checkIn 5, reviewActions 5, retro 8 / 5 / 14, notes 3, actions 6, checkOut 4
- 80: checkIn 8, reviewActions 7, retro 12 / 8 / 25, notes 5, actions 9, checkOut 6

Scoring constants (`data/scoring.json`): `{ goalMultiplier: 2, weakThreshold: 0.5, order: [format ids in tie-break order], maxAlternatives: 2 }`.

### The library (content to author in T-3)
The 12 formats, with their columns and supported durations (weights and texts are written when the files are authored; names are to be confirmed against funretrospectives.com in T-12):

| Format | Columns | Durations | Character |
|--------|---------|-----------|-----------|
| Start-Stop-Continue | Start, Stop, Continue | 30, 50, 80 | lean, general |
| Mad-Sad-Glad | Mad, Sad, Glad | 30, 50, 80 | emotions, tense/tired teams |
| 4Ls | Liked, Learned, Lacked, Longed for | 50, 80 | reflective, project |
| Sailboat | Wind, Anchors, Rocks, Island | 50, 80 | playful, project |
| Starfish | Keep doing, Less of, More of, Start doing, Stop doing | 50, 80 | extensive (5 columns) |
| Plus/Delta | Plus, Delta | 30, 50 | very lean |
| Rose-Thorn-Bud | Rose, Thorn, Bud | 30, 50 | bonding, gentle |
| Timeline | Early, Middle, Recent | 50, 80 | period/project overview |
| Three Little Pigs | Straw, Sticks, Bricks | 30, 50, 80 | fun, metaphor |
| Hot Air Balloon | Hot air, Sandbags, Storm clouds, Clear skies | 50, 80 | fun, project |
| Kudos Cards | Kudos for the team, Kudos for a person | 30, 50 | bonding, appreciation |
| Speed Car | Engine, Parachute | 30, 50 | fun, lean |

Every time budget (30, 50, 80) has at least 3 formats, so a recommendation always has one best match and up to 2 alternatives. A data test enforces this.

### Modules and components

**`formats/validate.ts`**: `validateFormat(input: unknown): { ok: true; format: Format } | { ok: false; errors: string[] }` checks the structure of a format: required fields, ID format, 2 to 5 columns with unique IDs and non-empty names, at least one supported duration, every `TimeSplit` with non-negative whole numbers summing exactly to its total, all weights between 0 and 3 and present for every answer option, at least 2 facilitation tips, a non-empty check-in question. `validateCustomFormat(format)` adds the custom rules (2 to 4 columns, with the over-limit exception from `custom.ts`; column names non-empty, at most 30 characters and unique ignoring upper/lower case; prompts at most 120 characters). The checks are built on the Zod `formatSchema` (which also defines the TypeScript types), and Zod's error messages are mapped to the readable `errors` strings.

**`formats/library.ts`**: loads all files in `data/library` with Vite's eager glob import (`import.meta.glob('./data/library/*.json', { eager: true })`), validates each (a failure throws a clear error naming the file, so a broken file is caught at the first test run and at build), sorts them by the tie-break order, and exposes `listFormats()`, `getFormat(id)` and `supports(format, budget)`.

**`formats/scoring.ts`**: `recommend(answers, formats, config): Recommendation`
```ts
interface Match { format: Format; score: number; maxScore: number; reasons: string[]; weak: boolean }
interface Recommendation { recommended: Match; alternatives: Match[]; weak: boolean }
```
- Hard filter: only formats with `timeSplits[answers.timeBudgetMin]` are candidates; if fewer than 1 remain the function throws (cannot happen with validated data).
- Score = `fit.mood[mood] + goalMultiplier × fit.goal[goal] + fit.depth[depth] + fit.setting[setting]`; the maximum is `3 × (1 + goalMultiplier + 1 + 1)`.
- Ranking: score descending, then the configured tie-break order, then ID (deterministic).
- `recommended` = best; `alternatives` = next up to `maxAlternatives` (at least 1 when at least 2 candidates exist).
- A match is `weak` when `score / maxScore < weakThreshold`; `Recommendation.weak` is the weak flag of the best match.
- Reasons: up to two short texts, built from the answers with the highest weights (at least 2): the format's own `reasons` text if present, otherwise a template such as "Works well for a tired team" or "Good when you want to reflect on the period since the last retro".

**`formats/custom.ts`**: pure editing functions that return a new format each time:
- `createCustomFromScratch()`: two empty columns, default check-in question (first of the generic list), `custom: true`.
- `createCustomFromLibrary(format)`: a deep copy with new column IDs, new custom ID and `custom: true`; the library format is not touched (tested with a deep-freeze).
- `addColumn(format)`: allowed only while the column count is below 4 (so never for a copy that has more than 4 columns).
- `removeColumn(format, id)`: allowed while more than 2 columns remain.
- `moveColumn(format, id, direction)`, `renameColumn`, `setPrompt`, `setCheckIn(format, question)` (the question must be in the generic list).
- `timeSplits` of a custom format: the generic default splits for all three budgets.
- `validateCustom(format)`: names non-empty, at most 30 characters and unique ignoring upper/lower case, prompts at most 120 characters, 2 to 4 columns, except that a copy of a library format may keep its original number of columns (more than 4) as long as nothing was added.

**`ui/format/flow.ts`** (signals, memory only): `answers`, `recommendation`, `chosen: ChosenFormat | null`, `draftCustom`. Reset when a new session creation starts. No storage of any kind (not even sessionStorage), so a reload during the flow starts from the questionnaire.

**Screens**
- `QuestionnairePage` (`#/new`): five questions as radio groups with labels and short helper texts for first-time facilitators; the "Show recommendation" button stays disabled until all five are answered, and the unanswered questions are marked; a link "Browse all formats" and a link "Create custom format".
- `RecommendationPage` (`#/new/recommendation`): the best match as a large card (name, description, columns, reasons, time split for the chosen time), 1-2 alternatives as smaller cards; the weak-match note and the links to the library and custom format when `weak`; "Use this format" on each card; "See details".
- `LibraryPage` (`#/new/library`): all 12 formats as cards with derived tags and durations.
- `FormatDetailsPage` (`#/new/library/<id>`): description, columns and prompts, time split for the chosen time (or all supported times when none was chosen), check-in question, facilitation tips, source attribution ("Based on <format name> on funretrospectives.com" with a link), "Use this format" and "Use as basis". The app footer carries one credit line.
- `TimeBudgetStep` (shown when a format is chosen without a time answer): "How much time do you have?" with the durations the chosen format supports (a custom format supports all three).
- `CustomFormatPage` (`#/new/custom`): column list with name and optional prompt, add/remove/move buttons honoring the rules, a check-in question select, inline error messages, "Save and continue".
- All screens are mobile-first with large touch targets; all texts are in `texts.ts`; every control has an accessible name.

### Interfaces
- **To Epic 1:** `ChosenFormat` and the function `startSessionCreation(chosen: ChosenFormat)`. Epic 1's `createSession` takes `format: Format` and `timeBudgetMin` (replacing `FormatRef`). Until then the placeholder `FormatRef` in Epic 1 is a structural subset of `Format`.
- **To Epic 3:** `Format.timeSplits[timeBudgetMin]`, `facilitationTips`, `PHASES`, `RETRO_STEPS`.
- **To Epic 4:** `Format.columns`, `Format.checkInQuestion`.
- **To Epic 5:** the chosen `Format` (including the columns of a custom format).

### Key flows

**Journey 1: Facilitator gets a recommendation.** Home → "Create session" → `QuestionnairePage` → all five answers → `recommend` → `RecommendationPage` showing the best match and 1-2 alternatives, each with reasons; when `weak`, the note and the links are shown too → "See details" opens `FormatDetailsPage` → "Use this format" stores `chosen = { format, timeBudgetMin, answers }` and calls `startSessionCreation`. Error path: unanswered questions block the button and are marked (AC-2).

**Journey 2: Facilitator browses the library.** From the questionnaire or the recommendation → `LibraryPage` → a card → `FormatDetailsPage` → "Use this format" (any format, whatever was recommended). If no time answer exists, `TimeBudgetStep` asks for it first; it offers only the durations the chosen format supports.

**Journey 3: Facilitator creates a custom format.** "Create custom format" (from the questionnaire, the recommendation, the library, or "Use as basis" on a format) → `CustomFormatPage` with the draft from `createCustomFromScratch` or `createCustomFromLibrary` → edit columns (2 to 4, with the over-4 rule for copies), choose a check-in question → "Save and continue": `validateCustom` shows errors or hands over `chosen = { format (custom: true), timeBudgetMin }` with the generic default time split. The custom format is not stored anywhere; it travels in the session state (Epic 1) and the documentation (Epic 5).

## Implementation Tasks

Tasks are ordered; T-2, T-3 (after T-1), T-4 and T-5 can run in parallel after T-2; UI tasks T-6 to T-9 after the logic tasks they use; T-11 needs T-6 to T-10 and (for the real hand-over) the Epic 1 create flow.

### T-1: Types, questionnaire definition and phase constants
- **Satisfies:** FR-2.1; AC-1
- **Depends on:** none (uses the Epic 1 project scaffold; if it does not exist yet, the same scaffold task as Epic 1 T-1 is run first)
- **Tests first (TDD):**
  - `tests/formats/questionnaire.test.ts`: the questionnaire has exactly 5 questions with IDs `mood`, `goal`, `time`, `depth`, `setting`; the options are exactly: mood (energized, neutral, tired, tense), goal (fun, bond, reflect-period, reflect-project), time (30, 50, 80), depth (lean, extensive), setting (in-room, remote); every question has a label and a helper text.
  - `tests/formats/phases.test.ts`: `PHASES` and `RETRO_STEPS` have the exact values in the data model.
- **Implementation:** `formats/types.ts`, `formats/questionnaire.ts`.
- **Done when:** tests pass.

### T-2: Format validation
- **Satisfies:** FR-2.7; NFR-2; AC-7, AC-18
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/formats/validate.test.ts`: a valid sample format passes; each of these fails with a message naming the field: missing name, missing description, 1 column, 6 columns, duplicate column IDs, empty column name, no supported duration, a time split that sums to 29 instead of 30, a negative or fractional minute, a missing weight for an answer option, a weight of 4, only 1 facilitation tip, empty check-in question; a library format with 5 columns is valid; `validateCustomFormat` rejects 1 column and 5 columns for a format created from scratch.
- **Implementation:** `formats/schema.ts` (Zod schemas and derived types) and `formats/validate.ts`. Add the `zod` dependency (Zod 4, or its mini build). Extra tests: `tests/formats/validate.limits.test.ts`: a custom format with a 31-character column name, a duplicate name differing only in upper/lower case, and a 121-character prompt each fail with a message naming the field; a 30-character name and a 120-character prompt pass; library formats are not subject to the custom name rules.
- **Done when:** tests pass.

### T-3: Library data and defaults
- **Satisfies:** FR-2.3, FR-2.7; AC-6, AC-7, AC-16, AC-18
- **Depends on:** T-2
- **Tests first (TDD):**
  - `tests/formats/library.test.ts`: loading finds exactly 12 formats with exactly the names Start-Stop-Continue, Mad-Sad-Glad, 4Ls, Sailboat, Starfish, Plus/Delta, Rose-Thorn-Bud, Timeline, Three Little Pigs, Hot Air Balloon, Kudos Cards, Speed Car; every format passes `validateFormat`; every time budget (30, 50, 80) has at least 3 formats; Starfish has 5 columns; IDs are unique; the tie-break order lists exactly the loaded IDs.
  - `tests/formats/defaults.test.ts`: the three generic default splits pass the time split rule and sum to 30, 50 and 80; the generic check-in list has at least 5 non-empty, unique questions.
  - `tests/formats/library.extensible.test.ts`: adding a valid extra format file to the test copy of the library folder makes it appear in `listFormats()` and in a recommendation without code changes (AC-16); an invalid extra file makes loading fail with an error naming the file.
- **Implementation:** the 12 JSON files in `data/library`, `data/defaults.json`, `formats/library.ts` (eager glob import). The glob pattern covers only `data/library/*.json`, so `defaults.json` and `scoring.json` are never loaded as formats. Each format file contains the fields of the data model including `fit` weights, optional `reasons`, check-in question and at least 2 facilitation tips.
- **Done when:** tests pass.

### T-4: Scorer
- **Satisfies:** FR-2.2; AC-3, AC-4, AC-5, AC-20
- **Depends on:** T-2, T-3
- **Tests first (TDD):**
  - `tests/formats/scoring.test.ts`: with the real library, answers (30, tired, lean, remote, reflect-period) and (80, energized, extensive, in-room, bond) produce different recommended formats; for every combination of all 5 answers (4 × 4 × 3 × 2 × 2 = 192) the recommendation has one recommended format and 1-2 alternatives, all supporting the chosen time and all distinct (AC-3, AC-5); results are deterministic across repeated calls (AC-4); with a synthetic library of formats with identical weights the tie-break order decides; with a synthetic library in which every weight is 0 for the answers, the best match is flagged `weak`, still returned, and `Recommendation.weak` is true (AC-20); with a good match, `weak` is false; every match has 1 or 2 reasons that mention an answer; the goal answer counts with the configured multiplier.
- **Implementation:** `formats/scoring.ts` and `data/scoring.json` (validated with the Zod `scoringConfigSchema` when loaded; an extra test in `tests/formats/scoring.config.test.ts` checks that an invalid config such as a negative multiplier or a threshold above 1 fails with a clear message).
- **Done when:** tests pass.

### T-5: Custom format logic
- **Satisfies:** FR-2.5, FR-2.6 (default split); AC-9, AC-10, AC-11, AC-12, AC-13, AC-15, AC-21
- **Depends on:** T-2, T-3
- **Tests first (TDD):**
  - `tests/formats/custom.test.ts`: a format from scratch has 2 columns and the first generic check-in question; adding columns works up to 4 and the 5th is refused; removing works down to 2 and the 1st removal below 2 is refused; moving changes the order; `validateCustom` fails with empty names and passes with 2 to 4 named columns (prompts optional); `createCustomFromLibrary(Starfish)` copies all 5 columns with new IDs and a new format ID, sets `custom: true`, and the original library object is unchanged (deep-frozen original, no mutation); in that copy removing a column is allowed and `addColumn` is refused while it has more than 4 columns; after removing to 4, adding is refused as well (the limit is 4); `validateCustom` accepts the unchanged 5-column copy; `setCheckIn` accepts only questions from the generic list; the custom format's time splits equal the generic defaults for 30, 50 and 80 and each sums to its total (AC-15); a custom format is never written to localStorage or sessionStorage (spies).
- **Implementation:** `formats/custom.ts`.
- **Done when:** tests pass.

### T-6: Questionnaire screen
- **Satisfies:** FR-2.1; NFR-1, NFR-4, NFR-5; AC-1, AC-2, AC-17
- **Depends on:** T-1
- **Tests first (TDD):**
  - `tests/ui/questionnaire.test.tsx`: the 5 questions are shown with their options and helper texts; "Show recommendation" is disabled until all are answered; unanswered questions are marked after an attempt; answering all enables the button; the page contains links "Browse all formats" and "Create custom format"; the whole questionnaire needs exactly 5 selections and 1 click (AC-17 proxy).
- **Implementation:** `QuestionnairePage.tsx`, `flow.ts` (answers), routes in the router.
- **Done when:** tests pass; works at 360 px width.

### T-7: Recommendation screen
- **Satisfies:** FR-2.2; AC-3, AC-5, AC-20; NFR-4
- **Depends on:** T-4, T-6
- **Tests first (TDD):**
  - `tests/ui/recommendation.test.tsx`: one recommended card and 1-2 alternative cards are shown, each with reasons; each shows the time split for the chosen time; "Use this format" stores the choice; when `weak` the note "Not a perfect fit, but closest to your answers" and the links to the library and custom format are shown, otherwise not.
- **Implementation:** `RecommendationPage.tsx`.
- **Done when:** tests pass.

### T-8: Library and format details screens
- **Satisfies:** FR-2.3, FR-2.4; AC-6, AC-7, AC-8; NFR-3
- **Depends on:** T-3, T-6
- **Tests first (TDD):**
  - `tests/ui/library.test.tsx`: 12 cards with names, derived tags and supported durations; a card opens the details.
  - `tests/ui/formatDetails.test.tsx`: details show description, columns with prompts, the time split (for the chosen time, or all supported times when none was chosen), check-in question, facilitation tips and the attribution "Based on <format name> on funretrospectives.com" with a link; the app footer carries one credit line; "Use this format" works for a format that was not recommended; when no time was chosen, the time step "How much time do you have?" offers only the supported times (a custom format offers all three); "Use as basis" opens the custom form with the copy.
- **Implementation:** `LibraryPage.tsx`, `FormatDetailsPage.tsx`, `TimeBudgetStep.tsx`.
- **Done when:** tests pass.

### T-9: Custom format screen
- **Satisfies:** FR-2.5; AC-9, AC-10, AC-11, AC-12, AC-13, AC-21; NFR-5
- **Depends on:** T-5, T-6
- **Tests first (TDD):**
  - `tests/ui/customFormat.limits.test.tsx`: the column name input stops at 30 characters and the prompt input at 120 (with a remaining-characters hint); two columns named "Ideas" and "ideas" show an inline "names must be different" message and block saving.
  - `tests/ui/customFormat.test.tsx`: from scratch the form shows 2 columns; "Add column" disappears or is disabled at 4; "Remove column" is disabled at 2; empty names show an inline message and block saving; the check-in question select lists only the generic questions; "Use as basis" with Starfish shows 5 columns, "Add column" is disabled, removing one is possible; saving a valid format hands over the choice; reload of the page (re-render from scratch) loses the draft and nothing is stored (storage spies).
- **Implementation:** `CustomFormatPage.tsx`.
- **Done when:** tests pass.

### T-10: Format and flow hygiene: no storage, no network
- **Satisfies:** NFR-6; AC-13, AC-19
- **Depends on:** T-6 to T-9
- **Tests first (TDD):**
  - `tests/formats/privacy.test.ts`: running the complete flow in the component tests (questionnaire, recommendation, custom format) makes no `fetch` or `XMLHttpRequest` call and writes nothing to `localStorage`, `sessionStorage` or `indexedDB` (spies).
- **Implementation:** fix any violation found; no new feature.
- **Done when:** tests pass.

### T-11: Hand-over to session creation
- **Satisfies:** FR-2.6; AC-14, AC-15
- **Depends on:** T-6 to T-10; the real hand-over also needs the Epic 1 session creation
- **Tests first (TDD):**
  - `tests/formats/handover.test.ts`: `startSessionCreation` receives a `ChosenFormat` whose format has columns, time split for the chosen budget, check-in question and facilitation tips; for a custom format the time split equals the generic default; a `ChosenFormat` whose format does not support its time budget is refused.
  - `tests/ui/handover.test.tsx`: after "Use this format", the next screen shows the chosen format name, its columns and the time budget (Epic 1's create page once it exists, otherwise a minimal "chosen format" screen at `#/new/continue`).
- **Implementation:** `startSessionCreation`, the `#/new/continue` stub; when Epic 1 exists: change `FormatRef` to `Format` in Epic 1's `types.ts`, pass the chosen format and budget into `createSession`, make Epic 1's "Create session" button route to `#/new`, and remove Epic 1's placeholder format.
- **Done when:** tests pass; with Epic 1 present, a created session contains the chosen format in its state.

### T-12: Content check and attribution (manual)
- **Satisfies:** NFR-3, NFR-4; AC-6
- **Depends on:** T-3
- **Tests first (TDD):** Not applicable (manual). Deliverable: `docs/format-sources.md` listing for each of the 12 formats the page on funretrospectives.com it is based on, the checked name, and the licence/attribution outcome; plus a usability check with one first-time facilitator timed against the 5-minute goal (AC-17, NFR-4).
- **Implementation:** fix names and texts in the data files if the check shows differences; finalize the attribution wording (AD-12).
- **Done when:** the document exists and the data files match it.

## Traceability
| AC | Tasks | Tests |
|----|-------|-------|
| AC-1 | T-1, T-6 | questionnaire, ui/questionnaire, e2e J1 |
| AC-2 | T-6 | ui/questionnaire, e2e J1 |
| AC-3 | T-4, T-7 | scoring, ui/recommendation, e2e J1 |
| AC-4 | T-4 | scoring |
| AC-5 | T-4, T-7 | scoring, ui/recommendation |
| AC-6 | T-3, T-8, T-12 | library, ui/library, e2e J2 |
| AC-7 | T-2, T-3, T-8 | validate, library, defaults, ui/formatDetails |
| AC-8 | T-8 | ui/library, ui/formatDetails, e2e J2 |
| AC-9 | T-5, T-9 | custom, ui/customFormat, e2e J3 |
| AC-10 | T-5, T-9 | custom, ui/customFormat, e2e J3 |
| AC-11 | T-5, T-9 | custom, ui/customFormat, e2e J3 |
| AC-12 | T-5, T-9 | custom, ui/customFormat, e2e J3 |
| AC-13 | T-5, T-9, T-10 | custom, privacy, e2e Privacy |
| AC-14 | T-11 | handover, ui/handover, e2e J1 |
| AC-15 | T-5, T-11 | custom, defaults, handover |
| AC-16 | T-3 | library.extensible |
| AC-17 | T-6, T-12 | ui/questionnaire (proxy), manual usability check |
| AC-18 | T-2, T-3 | validate, library |
| AC-19 | T-10 | privacy, e2e Privacy |
| AC-20 | T-4, T-7 | scoring, ui/recommendation, e2e J1b |
| AC-21 | T-5, T-9 | custom, ui/customFormat, e2e J3 |

| FR / NFR | Tasks |
|----------|-------|
| FR-2.1 | T-1, T-6 |
| FR-2.2 | T-4, T-7 |
| FR-2.3 | T-3, T-8 |
| FR-2.4 | T-8 |
| FR-2.5 | T-5, T-9 |
| FR-2.6 | T-5, T-11 |
| FR-2.7 | T-2, T-3 |
| NFR-1 | T-6, T-12 |
| NFR-2 | T-2, T-3 |
| NFR-3 | T-8, T-12 |
| NFR-4 | T-6, T-7, T-12 |
| NFR-5 | T-6, T-9 |
| NFR-6 | T-5, T-9, T-10 |

## E2E Test (Playwright)
The implement-epic skill builds and sets up this test later; this spec only describes it.

**File:** `e2e/epic2-format-selection.spec.ts`. One test per PRD journey, plus a weak-match test and a privacy test.

**How the app starts:** `vite preview` serves a production build (`npm run build`). The format selection needs no signaling server and no network, so nothing has to be stubbed. The app is opened at `/#/new`.

**Fixtures:** none (the real 12 library files are used). Helpers: `answer(page, {mood, goal, time, depth, setting})` clicks the radio options by their accessible names; `expectHandover(page, name)` checks the screen after "Use this format" (Epic 1's create page, or the `#/new/continue` stub, showing the chosen format name, its columns and the time budget).

**Tests:**
1. **J1 Recommendation** — open `/#/new`; click "Show recommendation" before answering → the button is disabled or the missing questions are marked (AC-2); answer 5 questions (30 min, tired, lean, remote, reflect on the period) → one recommended card and 1-2 alternatives with reasons are visible, and each shows a 30-minute time split; open "See details" on the recommended card → description, columns, check-in question and tips are visible; "Use this format" → hand-over screen shows the format name, its columns and "30 min". Repeat with a second answer set (80 min, energized, extensive, in-room, bond) and assert that the recommended format name differs and that the hand-over shows "80 min". Verifies AC-1, AC-2, AC-3, AC-4, AC-5, AC-14.
2. **J1b No weak-match note for a normal answer set** — with the answers of test 1, the "Not a perfect fit" note is not shown. This verifies only the negative side of AC-20; the positive side (note, library link and custom format link) needs a library in which every format is a weak match, so it is covered by the `scoring` and `ui/recommendation` tests with synthetic data.
3. **J2 Library** — from the questionnaire click "Browse all formats" → 12 cards (named exactly as AC-6); open "Starfish" → 5 columns, supported durations 50 and 80 visible; "Use this format" without a prior time answer → the "How much time do you have?" step offers only 50 and 80 → choose 50 → hand-over shows Starfish and "50 min". Verifies AC-6, AC-7, AC-8.
4. **J3 Custom format** — from the questionnaire click "Create custom format" → form with 2 empty columns; click "Save and continue" → inline error messages (AC-10); fill names, add columns until the "Add column" button is gone at 4 columns (AC-10); choose another check-in question (AC-12); save → hand-over shows the custom columns. Then start again: library → Starfish → "Use as basis" → 5 columns copied, "Add column" is not available, remove one column → 4 columns, save → hand-over shows 4 columns (AC-11, AC-21). Verify that the library's Starfish still shows 5 columns afterwards (AC-11). Reload the page → the flow restarts at the questionnaire and the custom format is gone (AC-13).
5. **Privacy** — during J1 and J3, requests recorded with `page.on('request')` go only to the app's own origin, and `localStorage` and `sessionStorage` contain no entries written by this epic (`page.evaluate`). Verifies AC-19, AC-13.

**Not covered by e2e (unit/component tests cover them):** AC-4 in detail (all 192 answer combinations), AC-7 details, AC-15, AC-16, AC-18, AC-20 (positive side), AC-17 (manual usability check, T-12).

**Stubbed:** nothing.
## Decision Log
### Cycle 1
- Q: How are the format data files checked against the one shared format definition? → A: A Zod schema that also provides the TypeScript types, runs in the tests and in the custom format form, with the custom-format rules kept as a separate check
- Q: How are the 12 library files loaded, so that a new format only needs a new file? → A: Vite's glob import with eager loading of the library folder
- Q: Where do the scoring constants live? → A: In a small data file next to the formats, checked with the same schema
- Q: When a format is chosen from the library or created as a custom format without answering the questionnaire first, how is the time budget set? → A: A short "How much time do you have?" step with three choices, showing only the durations the chosen format supports (a custom format supports all three)
- Q: How is the source (funretrospectives.com) credited? → A: On every library format's details page as "Based on <format name> on funretrospectives.com" with a link, plus one line in the app's footer; the exact wording is finalized after the licence check
- Q: What limits apply to the texts of a custom format? → A: Column names at most 30 characters and unique within the format (ignoring upper/lower case); prompts at most 120 characters

## Open Questions

None — confidence reached 90%.
