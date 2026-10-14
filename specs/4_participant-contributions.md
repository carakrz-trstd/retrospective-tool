# PRD: Epic 4 — Participant Contributions

Confidence: 92%

## Overview
**Goal:** Every participant can contribute individually in every relevant phase, and everything is attributable and visible to the group at the right time.

**In scope:**
- **Check-in:** a short warm-up question; each participant writes a short free-text response
- **Retrospective:** a board with the columns/prompts of the chosen format; participants add, edit and delete their own entries
- **Hidden until reveal:** other people's check-in and retro entries are hidden until the Facilitator reveals them; after that each entry is labeled with its author's name
- **Discussion notes:** a shared list of separate note items that all participants can add and edit; the Facilitator can delete any item and can mark one participant as note taker (a label)
- **Action items:** description, one or more owners chosen from the participants (at least one required), optional due date; can be edited and removed
- **Check-out / exit survey:** quick questions about how participants found the retro and how they found the tool (a 1-5 rating plus a free-text comment each); results are shown to the group as an aggregate with the individual comments, anonymously; participants can change their answers until the Facilitator closes the survey, and the group sees only a count such as "6 of 7 answered"
- Real-time sharing of all contributions and no loss when a participant reconnects
- Rules for who can edit and delete what, and limits on entry length

**Out of scope (other epics):**
- Creating sessions, joining, live sync, reconnect and host resume (Epic 1)
- Format questionnaire, library, custom formats, check-in question and columns as data (Epic 2)
- Phase navigation, timers, the reveal control, the "added something" counter and facilitation instructions (Epic 3)
- Grouping, voting, anonymous mode for retro entries and analytics (out of scope for v1 in the briefing)
- Documentation and export of all contributions (Epic 5)

**Dependencies:** Epic 1 (shared session state, participants, reconnect, offline writing). Uses the chosen format's columns/prompts and check-in question from Epic 2. Epic 3 provides the phases, the reveal control (one action that reveals all entries of the current phase at once) and the facilitator counter of participants who have added something. Epic 5 reads the contributions defined here.

**Given constraints (from the briefing and earlier decisions):**
- The Facilitator's browser is the authoritative host (Epic 1). Participants send their changes to it, and it sends other people's entries only after they have been revealed (Epic 1 AC-22).
- A participant's own entries are kept on their device (Epic 1) and are re-sent to the host when it returns after being offline.
- Entries added after the reveal are visible to everybody immediately, labeled with the author's name (Epic 3).
- Every retro and check-in contribution is labeled with the author's name (names with distinguishing suffix if duplicates, Epic 1).
- Discussion notes are a list of separate note items, each added, edited and deleted through the host, with the last change winning per item. Every item has a stable ID so that re-sending is safe.
- English only in v1; static site, no backend; mobile browsers must work for participants.

## User Journeys
### Journey 1: Check-in
1. In the Check-in phase, each participant sees the check-in question suggested by the chosen format (Epic 2).
2. They write a short free-text response (up to 280 characters). Other people's responses are hidden; they see their own.
3. The Facilitator reveals (Epic 3); all responses appear at once, labeled with names.

### Journey 2: Adding retro entries
1. In the Retrospective phase, each participant sees the board with the format's columns and prompts.
2. They add entries to any column, one after another (up to 280 characters each, no limit on the number), and can edit or delete their own entries.
3. Other people's entries are hidden; participants see their own entries.
4. After the reveal, all entries are shown in their columns, each labeled with the author's name.
5. An entry added after the reveal is visible to everybody immediately. Authors can still edit or delete their own entries until the session ends.

### Journey 3: Writing discussion notes
1. In the Discussion notes phase, the group sees a shared list of note items.
2. The Facilitator can mark one participant as note taker; the label is shown to everybody and anyone can still write notes.
3. Participants add note items, and everybody sees them in real time.
4. Anyone can edit any note item; the later change replaces the earlier one. The Facilitator can delete any item.

### Journey 4: Capturing action items
1. In the Action items phase, a participant adds an action item with a description, one or more owners chosen from the participants in the session, and optionally a due date.
2. Everybody sees the new action item in real time.
3. Anyone can edit an action item; the Facilitator can delete any action item.

### Journey 5: Check-out survey
1. In the Check-out phase, each participant answers quick questions about how they found the retro and how they found the tool itself (a 1-5 rating plus a free-text comment for each).
2. The group sees a count such as "6 of 7 answered" (not who), and can see the aggregate (e.g., average rating) and the individual comments, without names. The tool does not store who gave which rating.
3. Participants can change their answers until the Facilitator closes the survey; after that, answers are final.

### Journey 8: Action item owner leaves the session
1. A participant who owns an action item is removed from the session by the Facilitator (Epic 1) or leaves it.
2. The action item remains, and the owner stays on it as plain text with the name they had.

### Journey 6: Participant reconnects or Facilitator is offline
1. A participant's connection drops, or the Facilitator goes offline.
2. The participant keeps writing their own entries; they are kept on their device.
3. When the connection or the Facilitator returns, the entries are sent to the session without being lost or duplicated.

### Journey 7: Facilitator removes an inappropriate contribution
1. The Facilitator sees an entry, note item or action item that should not be there.
2. They delete it and it disappears for everybody.

## Acceptance Criteria
- AC-1 (FR-4.1): Given the Check-in phase, then each participant sees the format's check-in question and can write and edit a free-text response of up to 280 characters.
- AC-2 (FR-4.2): Given the Retrospective phase, then the board shows the chosen format's columns and prompts, and each participant can add, edit and delete their own entries in any column.
- AC-3 (FR-4.3): Given hidden entries, when a participant looks at the check-in or retro board before the reveal, then they see only their own entries, and the other participants' entries are not part of what their device has received (Epic 1 AC-22).
- AC-4 (FR-4.3): Given the Facilitator has revealed, then each entry is shown labeled with its author's name.
- AC-5 (FR-4.3): Given the reveal has happened, when a participant adds a new entry, then it is visible to everybody immediately, labeled with their name.
- AC-6 (FR-4.4): Given the Discussion notes phase, then the notes are a list of separate note items that all participants can add to, and changes appear for everybody in real time.
- AC-7 (FR-4.4): Given the Discussion notes phase, when the Facilitator marks a participant as note taker, then the label is shown to everybody, and any participant can still add and edit notes.
- AC-8 (FR-4.5): Given the Action items phase, when a participant adds an action item with a description and at least one owner chosen from the participants, then it appears for everybody; a due date is optional.
- AC-9 (FR-4.5): Given an action item, then it cannot be saved without a description and at least one owner, and owners can only be people who are in the session.
- AC-10 (FR-4.5): Given an action item, then it can be edited by any participant.
- AC-11 (FR-4.6): Given the Check-out phase, then each participant can answer the retro question and the tool question with a 1-5 rating and a free-text comment.
- AC-12 (FR-4.6): Given submitted survey answers, then the group sees an aggregate (e.g., average rating and number of answers) and the individual comments, with no names, and the tool does not store who gave which rating.
- AC-21 (FR-4.10): Given the Check-out phase with a running survey, then each participant can change their answers, and the group sees a count of how many have answered (e.g., "6 of 7"), not who.
- AC-22 (FR-4.10): Given the Facilitator closes the survey, then answers can no longer be changed, and the aggregate and comments are final.
- AC-23 (FR-4.11): Given an action item whose owner is removed from the session or has left, then the action item remains and shows the owner's name as plain text.
- AC-24 (FR-4.8): Given a note item, when any participant edits it, then the change replaces the earlier text for everybody, and the Facilitator can delete any note item.
- AC-13 (FR-4.7): Given contributions made by several participants, then they are shared in real time with all connected participants.
- AC-14 (FR-4.7): Given a participant who reloads or reconnects, then their own entries are still there, and entries written while offline are sent once, without duplicates, when the connection or the Facilitator returns.
- AC-15 (FR-4.8): Given an entry (check-in or retro), then its author can edit or delete it until the session ends, and nobody else can edit it.
- AC-16 (FR-4.8): Given an entry, note item or action item, when the Facilitator deletes it, then it disappears for everybody; participants other than the author cannot delete entries.
- AC-17 (FR-4.9): Given an entry or check-in response, when someone types more than 280 characters, then the input stops at 280 and shows the remaining characters; the number of entries per participant is not limited.
- AC-18 (NFR-1): Given a participant on a mobile device, then they can add an entry in a few taps.
- AC-19 (NFR-2): Given 8 participants with many entries, then the retro board stays usable and responsive.
- AC-20 (NFR-4): Given a re-sent entry, then it is not duplicated.

## Functional Requirements
- FR-4.1: Check-in: a short warm-up question (from the chosen format, Epic 2) is shown; each participant writes a short free-text response (same limit as other entries).
- FR-4.2: Retrospective: the board shows the chosen format's columns/prompts. Each participant can add, edit and delete their own entries in any column.
- FR-4.3: During check-in and the retrospective, other participants' entries are not visible until the Facilitator reveals them. A participant always sees their own entries. Once revealed, each entry is labeled with its author's name. Entries added after the reveal are visible to everybody immediately.
- FR-4.4: Discussion notes: a shared list of separate note items that all participants can add and edit (the later change replaces the earlier one). The Facilitator can mark one participant as note taker; this is a label shown to everybody, and anyone can still write notes.
- FR-4.5: Action items: participants can add action items, each with a description, one or more owners chosen from the participants (at least one required), and optionally a due date. Anyone can edit an action item.
- FR-4.6: Check-out / exit survey: each participant answers quick questions about (a) how they found the retro and (b) how they found the tool itself (a 1-5 rating plus a free-text comment for each). Results are shown to the group as an aggregate with the individual comments, anonymously; the tool does not store who gave which rating.
- FR-4.7: All contributions are shared in real time using the shared session state from Epic 1 and are not lost or duplicated if a participant reconnects or the Facilitator is offline.
- FR-4.8: Entries (check-in and retro) can be edited and deleted only by their author, until the session ends. Notes and action items can be edited by everyone. The Facilitator can delete any entry, note item or action item.
- FR-4.10: Survey answers can be changed until the Facilitator closes the survey; the group sees only a count of how many participants have answered, not who.
- FR-4.11: If the owner of an action item is removed from the session or leaves, the action item remains and shows the owner's name as plain text.
- FR-4.9: An entry or check-in response has a maximum of 280 characters. The number of entries per participant is not limited.

## Non-Functional Requirements
- NFR-1: Entry input is quick and works well on mobile.
- NFR-2: The retro board stays usable with 8 participants and many entries.
- NFR-3: Contributions are exchanged only between the participants' browsers; no content is sent to a server operated for this tool (Epic 1 NFR-1).
- NFR-4: Re-sending entries after a reconnect is safe: sending the same entry twice never creates a duplicate, because every item has a stable ID.

## Decision Log
### Cycle 1
- Q: How should several people write the discussion notes at the same time? → A: A list of separate note items, added, edited and deleted through the host, last change wins per item
- Q: How long can an entry be, and how many entries can a participant add? → A: Up to 280 characters per entry and no limit on the number of entries
- Q: Who can edit or delete entries, notes and action items? → A: Entries: only the author, until the session ends; notes and action items: everyone can edit; the Facilitator can delete any entry, note or action item (note: this goes further than the "own items" wording in the notes option; Q8 asks for confirmation)
- Q: Is the check-in response only free text? → A: Free text only, short (same limit as other entries)
- Q: What does "note taker" do? → A: The Facilitator marks one participant as note taker, shown to everybody; it is a label and anyone can still write notes
- Q: Can an action item have more than one owner, and is the owner required? → A: One or more owners, required (chosen instead of the recommended exactly one owner)
- Q: Is the exit survey anonymous or labeled with names? → A: Ratings and comments are anonymous in the results; the tool does not store who gave which rating
### Cycle 2
- Q: Which rule applies to individual note items (own items only, or anyone can edit)? → A: Anyone can edit any note item (the later change replaces the earlier one), and the Facilitator can delete any item
- Q: Can a participant change their survey answers after submitting, and how does the group see how many have answered? → A: Answers can be changed until the Facilitator closes the survey, and the group sees only a count such as "6 of 7 answered", not who
- Q: What happens to an action item's owner if that person is removed from the session or leaves it? → A: The owner stays on the action item as plain text with the name they had, and the action item remains

## Open Questions

None — confidence reached 90%.
