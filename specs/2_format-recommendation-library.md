# PRD: Epic 2 — Format Recommendation & Library

Confidence: 92%

## Overview
**Goal:** Before creating a session, the Facilitator answers a few questions and receives a well-fitting retrospective format, or defines their own. The chosen format and time budget are handed to session creation.

**In scope:**
- A short questionnaire (5 questions) before session creation
- A recommendation: one recommended format and 1-2 alternatives, each with a short reason
- A curated library of 12 formats based on funretrospectives.com, with name, description, columns/prompts, suggested time split per total time, mood/goal tags, a suggested check-in question and facilitation tips
- Browsing the library and selecting any format, regardless of the recommendation
- Creating a custom format with the Facilitator's own categories/columns (name and optional prompt per column), from scratch or by using a library format as a basis
- Handing the chosen format (library or custom) and the chosen time budget over to session creation
- Maintaining the library without changing the tool's functionality

**Out of scope (other epics):**
- Session creation, joining and live collaboration (Epic 1)
- Phases, timers and facilitation instructions during the session (Epic 3), which use the time budget, time split, check-in question and facilitation tips handed over here
- Entering retro entries on the board (Epic 4), which uses the format's columns/prompts
- Documentation of the chosen format in the export (Epic 5), including custom formats, because they are not saved anywhere else

**Dependencies:** none. Epic 1 consumes the chosen format and time budget when a session is created (Epic 1 FR-1.1). Until this epic is finished, Epic 1 and Epic 4 use a placeholder format with the same structure.

**Given constraints (from the briefing and earlier decisions):**
- Static site on GitHub Pages; TypeScript + Vite + Preact; no backend, no accounts.
- Library formats are JSON data files in the repository, bundled at build time, edited via pull request, and validated against one shared format definition (which custom formats also use).
- The recommendation is computed by declarative scoring in the format data (mood/goal tags and weights per format) with one generic scorer; the chosen time budget is a hard filter against each format's supported durations.
- Formats are based on funretrospectives.com; use of its content respects attribution/licence (open item in the briefing).
- English only in v1.
- A first-time facilitator with no coaching background must be able to follow the questionnaire and understand the recommendation.

## User Journeys
### Journey 1: Facilitator gets a recommendation
1. The Facilitator opens the tool and chooses to start a new retrospective.
2. They answer 5 questions: team mood (energized / neutral / tired / tense), goal (have fun / bond as a team / reflect on the period since the last retro / reflect on a specific project), available time (30 / 50 / 80 min), depth (lean / extensive), and setting (in-room / remote).
3. The tool shows one recommended format and 1-2 alternatives, each with a short reason why it fits. If the best match is weak, it is marked with a note such as "Not a perfect fit, but closest to your answers", and the library and "Create custom format" are offered.
4. The Facilitator opens a format to see its details (description, columns/prompts, time split for the chosen time, check-in question, facilitation tips).
5. They accept the recommendation or select another, and continue to create the session (Epic 1).

### Journey 2: Facilitator browses the library
1. From the questionnaire or the recommendation, the Facilitator opens the full library.
2. They scan the 12 formats with their tags (mood, goal, durations, setting).
3. They open a format's details and select it, regardless of what was recommended.

### Journey 3: Facilitator creates a custom format
1. The Facilitator chooses "Create custom format", either from scratch or with "Use as basis" on a library format.
2. With "Use as basis", the library format's columns/prompts are copied and can be freely edited; the library itself is never changed.
3. They give each category/column a name and an optional prompt, and add, remove or reorder columns (2 to 4 columns). A format copied from a library format with more than 4 columns (e.g., Starfish with 5) keeps its columns and the Facilitator can remove columns, but cannot add columns beyond the 4 once the format is over that limit.
4. They choose a check-in question from a short list of generic check-in questions (changeable).
5. They save the format for this session only and continue to create the session. The custom format is not remembered for later sessions, and appears in the session documentation (Epic 5).

## Acceptance Criteria
- AC-1 (FR-2.1): Given the Facilitator starts a new session, when the questionnaire is shown, then it has exactly these 5 questions: mood (energized / neutral / tired / tense), goal (have fun / bond as a team / reflect on the period since the last retro / reflect on a specific project), time (30 / 50 / 80 min), depth (lean / extensive) and setting (in-room / remote).
- AC-2 (FR-2.1): Given the questionnaire, when a question is unanswered, then the recommendation cannot be requested and the missing question is indicated.
- AC-3 (FR-2.2): Given a completed questionnaire, when the recommendation is shown, then there is one recommended format and 1-2 alternatives, each with a short reason that refers to the answers.
- AC-4 (FR-2.2): Given two clearly different answer sets (e.g., 30 min + tired + lean vs. 80 min + bond as a team + extensive), when the recommendations are compared, then the recommended formats differ and each fits its time budget.
- AC-5 (FR-2.2): Given a time budget, when formats are recommended, then every recommended format supports that time budget; formats that do not are never recommended.
- AC-6 (FR-2.3): Given the library, then it contains exactly these 12 formats: Start-Stop-Continue, Mad-Sad-Glad, 4Ls, Sailboat, Starfish, Plus/Delta, Rose-Thorn-Bud, Timeline, Three Little Pigs, Hot Air Balloon, Kudos Cards and Speed Car (names to be confirmed against funretrospectives.com).
- AC-7 (FR-2.3): Given a library format, then it has a name, description, columns/prompts, a time split for each supported total time (30 / 50 / 80 min) covering the six phases and the three steps of the retro phase (write, reveal, discuss; see Epic 3), mood/goal/setting tags, a suggested check-in question and facilitation tips.
- AC-8 (FR-2.4): Given the library, when the Facilitator browses it, then they can open each format's details and select any format regardless of the recommendation.
- AC-9 (FR-2.5): Given the custom format form, when the Facilitator enters 2 to 4 columns with names (prompts optional), then the format can be saved and used for a session.
- AC-10 (FR-2.5): Given the custom format form, when a column name is empty or the number of columns is fewer than 2 or more than 4, then saving is blocked with a message.
- AC-11 (FR-2.5): Given a library format, when the Facilitator chooses "Use as basis", then its columns/prompts are copied into a custom format, can be changed freely, and the library format itself stays unchanged.
- AC-12 (FR-2.5): Given a custom format, then it gets a check-in question chosen from a short list of generic check-in questions, which the Facilitator can change.
- AC-13 (FR-2.5): Given a custom format, then it is not stored for later sessions: after the session it is no longer offered, and it is part of the session documentation (Epic 5).
- AC-14 (FR-2.6): Given a chosen format (library or custom) and time budget, when the Facilitator continues, then session creation (Epic 1) receives the columns/prompts, time split, check-in question, facilitation tips and total time, and they are shown in the session.
- AC-15 (FR-2.6): Given a custom format and a chosen total time, then a generic default time split is used for it.
- AC-16 (FR-2.7): Given the library data, when a format is added or edited by changing the data files only, then it appears in the library and takes part in recommendations without any functional change.
- AC-17 (NFR-1): Given a first-time Facilitator, when they complete the questionnaire and choose a format, then it takes under 5 minutes.
- AC-18 (NFR-2): Given the library data, when it is validated, then every format has all required fields, and a format with missing or invalid fields is reported before release.
- AC-21 (FR-2.5): Given a library format with more than 4 columns (e.g., Starfish with 5), when the Facilitator chooses "Use as basis", then all its columns are copied and can be saved as is; columns can be removed, but no column can be added while the format has more than 4 columns, and a new format from scratch is still limited to 4.
- AC-20 (FR-2.2): Given answers for which even the best-scoring format is only a weak match, when the recommendation is shown, then the best matches are still shown, each weak match is marked with a note such as "Not a perfect fit, but closest to your answers", and links to the library and "Create custom format" are offered.
- AC-19 (NFR-6): Given the questionnaire and custom format form, then no data from them is sent to a server.

## Functional Requirements
- FR-2.1: Before session creation, the Facilitator answers 5 questions: team mood (energized / neutral / tired / tense), goal (have fun / bond as a team / reflect on the period since the last retro / reflect on a specific project), available time (30 / 50 / 80 min), depth (lean / extensive), and setting (in-room / remote). All are required.
- FR-2.2: The tool recommends one format and 1-2 alternatives based on the answers, each with a short reason why it fits. The recommendation is computed by declarative scoring from the mood/goal tags and weights in the format data; the time budget is a hard filter, so no format is recommended that cannot fit it. If the best matches are weak, they are still shown, marked with a note such as "Not a perfect fit, but closest to your answers", and the library and "Create custom format" are offered.
- FR-2.3: A curated library of 12 formats, based on funretrospectives.com, is available: Start-Stop-Continue, Mad-Sad-Glad, 4Ls, Sailboat, Starfish, Plus/Delta, Rose-Thorn-Bud, Timeline, Three Little Pigs, Hot Air Balloon, Kudos Cards and Speed Car. Each format has: name, description, columns/prompts for the retro, a time split for each supported total time (30 / 50 / 80 min) covering the six phases and the three steps of the retro phase (write, reveal, discuss; see Epic 3), mood/goal/setting tags, a suggested check-in question, and facilitation tips.
- FR-2.4: The Facilitator can browse the library, see format details, and select any format regardless of the recommendation.
- FR-2.5: The Facilitator can create a custom format by defining their own categories/columns (2 to 4 columns, name and optional prompt per column; a copy of a library format with more than 4 columns keeps its columns and can only have columns removed, not added, while over 4), from scratch or with "Use as basis" on a library format (copied and freely editable; the library is never changed). A custom format gets a check-in question from a short list of generic check-in questions, which can be changed. A custom format exists only for the session it was created for.
- FR-2.6: The chosen format (library or custom) and the chosen time budget are handed over to session creation as the definition used throughout the session. This includes columns/prompts, time split, check-in question and facilitation tips. A custom format uses a generic default time split.
- FR-2.7: Formats can be added or edited by changing the format data files only, without changing the tool's functionality.

## Non-Functional Requirements
- NFR-1: Completing the questionnaire and choosing a format takes under 5 minutes.
- NFR-2: The library data is checked against a single shared definition of what a format is (also used for custom formats), so that missing or invalid fields are detected before release.
- NFR-3: Use of funretrospectives.com content respects attribution/licence (open item from the briefing).
- NFR-4: A first-time facilitator with no coaching background can understand the questions, the recommendation and the formats.
- NFR-5: The questionnaire, recommendation, library and custom format form are fully usable on mobile browsers.
- NFR-6: No data from this epic is sent to a server; nothing from the questionnaire or custom formats is stored on the device for later sessions.

## Decision Log
### Cycle 1
- Q: How are the library formats stored and maintained? → A: JSON data files in the repository, bundled at build time and edited via pull request, validated against one shared format definition
- Q: How is the recommendation computed from the answers? → A: Declarative scoring in the format data (mood/goal tags and weights per format) with one generic scorer; time is a hard filter
- Q: Which questions should the questionnaire contain? → A: 5 questions: mood, goal, time, depth and setting (in-room / remote)
- Q: Which formats should the curated library contain at launch? → A: The 12 formats listed in FR-2.3, to be confirmed against funretrospectives.com
- Q: Can the Facilitator adjust a library format for a session? → A: Yes: "Use as basis" copies it into a custom format that can be freely edited; the library is never changed
- Q: Should a custom format be remembered for later sessions? → A: No: it only exists for its session and appears in the documentation (Epic 5)
- Q: How are the suggested time splits per phase defined? → A: Each format has a time split for each supported total time (30 / 50 / 80 min) in its data; custom formats use a generic default
- Q: Where does the check-in question come from? → A: Each library format suggests one; custom formats pick from a short list of generic ones, changeable by the Facilitator
### Cycle 2
- Q: What should happen if no format fits well? → A: Always show the best matches anyway, mark a weak match with a note such as "Not a perfect fit, but closest to your answers", and offer the library and "Create custom format"
- Q: How many columns can a custom format have? → A: 2 to 4 columns (chosen instead of the recommended 2 to 6)
### Cycle 3
- Q: What happens with "Use as basis" on a library format with more than 4 columns? → A: The limit applies when creating from scratch and when adding columns; a copied library format keeps its columns, and columns can be removed but not added beyond 4 once over the limit

## Open Questions

None — confidence reached 90%.
