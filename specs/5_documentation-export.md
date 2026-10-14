# PRD: Epic 5 — Documentation & Export

Confidence: 92%

## Overview
**Goal:** At the end of the session the team gets a complete record they can keep, and is clearly warned that nothing is saved by the tool.

**In scope:**
- Automatic documentation at the end of the session: title, date, participants and roles, chosen format (including a custom format's columns), check-in responses, retrospective entries (labeled with names), discussion notes, action items with owners (and due dates), and check-out results
- A preview of the documentation before export
- Export as a Markdown file (download)
- Export as rich text copied to the clipboard (for pasting into Confluence), and a downloadable HTML file
- Export as CSV for importing into Miro
- A prominent warning that the session is not saved, on the documentation screen and when someone tries to leave without having exported
- Showing which exports have been completed on this device
- Removing the locally kept session data when the person leaves the documentation screen (Epic 1)
- Every participant (not only the Facilitator) can open and export the documentation on their own device, even if the Facilitator is offline

**Out of scope (other epics):**
- Creating sessions, joining, live sync, host resume, local data handling in general (Epic 1); the optional session title is entered at session creation (Epic 1 FR-1.1)
- Format questionnaire, library and custom formats (Epic 2)
- Phases, timers, reveal and the end of the Check-out phase (Epic 3); the warning about still-hidden entries when the Facilitator ends the session is shown at that moment (Epic 3 and Epic 1 end-of-session action)
- Entering the contributions themselves (Epic 4)
- Direct Confluence/Miro API integration, PDF export, saving documentation anywhere other than the user's device (not in v1)

**Dependencies:** Epic 3 (the session moves to the documentation after the Check-out phase) and Epic 4 (the contributions that the documentation contains). Also uses the session information from Epic 1 (participants, roles, date, optional title) and Epic 2 (the chosen format).

**Given constraints (from the briefing and earlier decisions):**
- Static site, no backend; the documentation is generated on the user's device and nothing is sent anywhere.
- The documentation is built from one document made from the session data, with three small renderers for Markdown, HTML and CSV. The preview and all exports show the same content.
- Text is escaped for each format (Markdown special characters, HTML entities, CSV quoting and protection against cells that start with =, +, - or @).
- When the session ends, the Facilitator's device sends a final snapshot of all revealed content to every participant, and each device keeps it until the person leaves the documentation screen. The snapshot contains no unrevealed entries and no individual survey answers linked to names. If the Facilitator drops out before ending the session, participants export what their device already holds from live sync.
- Rich text is copied as formatted HTML and plain text with the browser's clipboard feature, with a fallback that selects and copies a visible rendered version. Success or failure is shown to the user. The downloadable HTML file is always available as a separate option.
- Survey answers are never linked to names in the documentation (Epic 4).
- English only in v1; mobile browsers must work for participants.

## User Journeys
### Journey 1: Facilitator ends the session and sees the documentation
1. After the Check-out phase, the Facilitator ends the session (Epic 1 and Epic 3).
2. If entries are still hidden (never revealed), the Facilitator is warned and can reveal them first; entries that stay hidden are not part of the documentation.
3. Every participant sees the documentation screen with a prominent warning: the session is not saved and the documentation must be saved or downloaded to their device.
4. The screen shows a preview of the documentation and the export options.

### Journey 2: Exporting in several formats
1. A participant downloads the Markdown file; the file name contains the session title (or the default), the date and the format name.
2. They copy the rich text and paste it into a Confluence page; the formatting is kept (action items as a table).
3. They download the CSV and import it into a Miro board; the entries appear as separate items.
4. The screen shows which exports have been completed on this device, and the person can still export the other formats after the first one.

### Journey 3: Leaving without exporting
1. A participant tries to close the tab or leave the documentation screen without having exported.
2. The tool warns that the session is not saved and the documentation will be lost, and asks them to confirm leaving.
3. If they confirm, the locally kept data for the session is removed.

### Journey 4: Participant exports on their own device
1. A participant who is not the Facilitator opens the documentation screen on their own device.
2. They export what they need, independently of the Facilitator and of other participants, even if the Facilitator is offline.

### Journey 5: Facilitator drops out before the session ends
1. The Facilitator's browser goes offline and does not return (Epic 1).
2. A participant uses the 15-minute hint to copy their entries, or opens the documentation from what their device holds.
3. They export it, with a note that it may be incomplete.

### Journey 6: Session title
1. When creating the session (Epic 1), the Facilitator can enter an optional title, such as the team or project name.
2. The title appears in the documentation heading and in file names. Without a title, the heading is "Retrospective, <date>, <format name>".

## Acceptance Criteria
- AC-1 (FR-5.1): Given a session that has ended, then the documentation contains the title (or the default heading), the date, participants and roles, the chosen format (with the columns of a custom format), check-in responses, retrospective entries by column labeled with author names, discussion notes, action items with owners and due dates, and the check-out results.
- AC-2 (FR-5.1): Given the check-out results, then the documentation contains the aggregate ratings, the number of answers and the individual comments without names.
- AC-3 (FR-5.1): Given documentation content, then it contains no individual survey answers linked to names.
- AC-4 (FR-5.2): Given the documentation screen, then a preview of the documentation is shown that matches the content of the exports.
- AC-5 (FR-5.3): Given the documentation, when the participant chooses Markdown, then a .md file is downloaded with the full content.
- AC-6 (FR-5.4): Given the documentation, when the participant chooses "Copy for Confluence", then formatted text is copied to the clipboard as HTML and plain text, and pasting into Confluence keeps headings, lists and tables.
- AC-7 (FR-5.4): Given a browser in which copying formatted text with the clipboard feature is not possible, when the participant chooses "Copy for Confluence", then a fallback selects and copies a visible rendered version, and success or failure of every copy is shown.
- AC-8 (FR-5.4): Given the documentation, when the participant chooses HTML download, then an .html file with the full content is downloaded.
- AC-9 (FR-5.5): Given the documentation, when the participant chooses CSV, then a .csv file is downloaded with one row per item (retro entry, check-in response, note item, action item) and the columns Type, Column (or phase), Text, Author, Owner(s) and Due date, so that each item becomes its own item in Miro.
- AC-10 (FR-5.5): Given text that starts with =, +, - or @, then it is protected in the CSV so that a spreadsheet does not run it as a formula.
- AC-11 (FR-5.6): Given the documentation screen, then a prominent warning says the session is not saved and the documentation must be saved or downloaded to the local device.
- AC-12 (FR-5.6): Given a participant who has not exported, when they try to close the tab or leave, then a warning asks them to confirm leaving.
- AC-13 (FR-5.7): Given exports on this device, then the screen shows which of the exports (Markdown, rich text, HTML, CSV) have been completed.
- AC-14 (FR-5.7): Given a participant who has exported one format, then they can still export the other formats; the locally kept session data is removed only when they leave the documentation screen (after at least one export, or after confirming that they want to leave without exporting).
- AC-15 (FR-5.8): Given a participant who is not the Facilitator, then they can open and export the documentation on their own device.
- AC-16 (FR-5.9): Given the session has ended, then every participant device receives and keeps a final snapshot of all revealed content until the person leaves the documentation screen, so that it can export even if the Facilitator goes offline right afterwards.
- AC-17 (FR-5.9): Given the Facilitator drops out before ending the session, when a participant opens the documentation, then it is built from what their device holds, with a note that it may be incomplete.
- AC-18 (FR-5.10): Given special characters in entries (e.g., *, #, <, &, quotation marks, line breaks), then each export shows them as text and does not break the format.
- AC-19 (FR-5.11): Given entries that were never revealed when the Facilitator ends the session, then the Facilitator is warned and can reveal them first; entries that stay hidden are not part of the documentation.
- AC-20 (FR-5.12): Given action items in the Markdown and rich text documentation, then they are shown as a table with the columns Action, Owner(s) and Due date.
- AC-21 (FR-5.13): Given a session title entered at creation (Epic 1), then it is shown in the documentation heading and in file names; without a title, the heading is "Retrospective, <date>, <format name>".
- AC-22 (NFR-1): Given the documentation, then nothing is sent to a server during generation or export.
- AC-23 (NFR-2): Given a session with 8 participants and many entries, then the documentation is generated and exported in a few seconds.

## Functional Requirements
- FR-5.1: At the end of the session, documentation is generated automatically, containing: title (or the default heading), date, participants and roles, chosen format (including the columns of a custom format), check-in responses, retrospective entries (labeled with names), discussion notes, action items with owners (and due dates), and check-out results (aggregate ratings, number of answers and individual comments without names).
- FR-5.2: The documentation can be previewed before export, and the preview matches the exports.
- FR-5.3: Export as a Markdown file (download).
- FR-5.4: Export as rich text copied to the clipboard (formatted HTML and plain text) so that it can be pasted into Confluence with formatting preserved, with a fallback that selects and copies a visible rendered version if the clipboard feature is not available. A downloadable HTML file is also available.
- FR-5.5: Export as CSV suitable for importing into Miro: one row per item (retro entry, check-in response, note item, action item) with the columns Type, Column (or phase), Text, Author, Owner(s) and Due date.
- FR-5.6: A prominent warning explains that the session is not saved by the tool and the documentation must be saved or downloaded to the local device. It is shown on the documentation screen and again when someone tries to leave without having exported.
- FR-5.7: The tool shows which exports have been completed on this device. The locally kept session data is removed only when the person leaves the documentation screen (after at least one export, or after confirming that they want to leave without exporting), not after each export (Epic 1 FR-1.9).
- FR-5.8: Any participant (not only the Facilitator) can open and export the documentation on their own device.
- FR-5.9: When the session ends, the Facilitator's device sends a final snapshot of all revealed content to every participant, and each device keeps it until the person leaves the documentation screen, so that every participant can export even if the Facilitator goes offline afterwards. If the Facilitator drops out before ending the session, the documentation is built from what the device already holds, with a note that it may be incomplete.
- FR-5.10: Text from participants is escaped for each export format so that special characters never break the format, and spreadsheet formulas in CSV are neutralized.
- FR-5.11: Entries that were never revealed are not part of the documentation. Before the session ends, the Facilitator is warned if entries are still hidden and can reveal them first.
- FR-5.12: Action items are shown as a table with the columns Action, Owner(s) and Due date in the Markdown and rich text documentation.
- FR-5.13: The documentation has an optional session title (e.g., team or project name) that the Facilitator can enter when creating the session. It is shown in the documentation heading and in file names. Without a title, the heading is "Retrospective, <date>, <format name>".

## Non-Functional Requirements
- NFR-1: Export is generated on the user's device; no content is sent anywhere (Epic 1 NFR-1).
- NFR-2: Generation and export take only a few seconds for a session of 8 participants.
- NFR-3: The exports can be pasted into Confluence and imported into Miro without manual rework (success criterion from the briefing).
- NFR-4: The documentation screen, preview and export actions are fully usable on mobile browsers.
- NFR-5: The documentation and all exports are in English.
- NFR-6: The documentation, the final snapshot and the exports contain no unrevealed entries and no survey answers linked to names.

## Decision Log
### Cycle 1
- Q: How is the documentation generated from the session? → A: One document built from the session data, with three small renderers for Markdown, HTML and CSV
- Q: How does each participant get the complete final data when the session ends, including when the Facilitator drops out? → A: The Facilitator's device sends a final snapshot of all revealed content to every participant when the session ends, and each device keeps it until export
- Q: How is rich text copied for Confluence? → A: Copy as formatted HTML and plain text with the browser's clipboard feature, with a fallback that selects and copies a visible rendered version
- Q: What happens to entries that were never revealed when the session ends? → A: They are not part of the documentation, and the Facilitator is warned before ending the session if entries are still hidden, with an option to reveal them first
- Q: When is the locally kept session data removed after exporting? → A: Only when the person leaves the documentation screen (after at least one export, or after confirming that they want to leave without exporting), not after each export
- Q: What should the CSV for Miro contain? → A: One row per item with columns Type, Column (or phase), Text, Author, Owner(s) and Due date
- Q: How are action items shown in the rich text and Markdown documentation? → A: As a table with the columns Action, Owner(s) and Due date
- Q: Does the documentation have a title or team name? → A: An optional session title entered when creating the session, shown in the documentation heading and file names, with the date and format name as the default

## Open Questions

None — confidence reached 90%.
