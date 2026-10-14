# PRD: Epic 3 — Guided Session Flow

Confidence: 92%

## Overview
**Goal:** Someone with no facilitation experience can run the whole retrospective by following the tool. The Facilitator moves everybody through six fixed phases, with short instructions and a shared timer for each.

**In scope:**
- The fixed phase order: Check-in, Review of previous action items, Retrospective, Discussion notes, Action items, Check-out
- Facilitator-controlled navigation (forward and back, freely between all six phases), with all participants following automatically
- Three steps inside the Retrospective phase: write silently (entries hidden), reveal, discuss
- Short on-screen facilitation instructions per phase, written for a non-expert, and the chosen format's facilitation tips in the retro phase
- A suggested time per phase, taken from the chosen format's time split for the chosen total time (Epic 2)
- A shared timer (start, pause, reset) that all participants see; timers are advisory
- A visual signal plus a short sound on every device when a timer reaches zero; every participant can mute the sound on their own device, and the Facilitator can mute it for everybody
- A time for each of the three retro steps, defined in the format's time split (Epic 2)
- Each phase and step keeps its own remaining time when the Facilitator goes back and forth
- The "Review of previous action items" phase as a reminder only (nothing is stored or imported)
- A progress overview for the Facilitator (current phase, remaining phases, time used versus planned)
- A reveal control that the Facilitator uses to show all participants' hidden entries of the current phase at once (the entry content and hiding behavior come from Epic 4)
- A counter that shows the Facilitator how many participants have added something

**Not in v1 (decided):**
- Reassigning the Facilitator role to another participant. This was roadmap requirement 3.8. It is documented as a limitation: the Facilitator can resume on the same device (Epic 1). It is removed from v1 because handing over the host would need a new connection ID and a new join link, which contradicts the Epic 1 decisions.

**Out of scope (other epics):**
- Creating sessions, joining, live sync, host resume (Epic 1)
- Format questionnaire, library, custom formats, time splits, check-in questions and format tips as data (Epic 2)
- The content areas themselves: check-in responses, retro board, notes, action items and survey (Epic 4)
- Documentation and export (Epic 5)

**Dependencies:** Epic 1 (shared session state, Facilitator role, connection status). Uses the chosen format, time budget, time split, check-in question and facilitation tips from Epic 2. Epic 4 provides the content areas shown in each phase and the hidden-until-reveal entries that the reveal control (here) acts on.

**Given constraints (from the briefing and earlier decisions):**
- The Facilitator's browser is the authoritative host (Epic 1). Phase, step and timer state are part of that host state, so they are restored when the Facilitator resumes.
- The host stores the timer as status, start time, duration and remaining time; each device calculates the remaining time itself, and only start/pause/reset are sent to the others.
- Timers are advisory: they never block work when they end and never change the phase.
- English only in v1; static site, no backend.
- A first-time facilitator must be able to complete the flow using only on-screen guidance.

## User Journeys
### Journey 1: Facilitator runs the session phase by phase
1. After pressing Start in the lobby (Epic 1), everybody sees the Check-in phase.
2. The Facilitator sees the full instruction for the phase (what to do, what to say), the suggested time and the timer. Participants see a one-line "what we are doing now" and the timer.
3. The Facilitator starts the timer, the group works, and the Facilitator moves everyone to the next phase when ready.
4. Participants see the same phase and the same timer on their own devices at all times.
5. After the Check-out phase, the session moves on to the documentation (Epic 5).

### Journey 2: Retrospective phase with three steps
1. In the Retrospective phase, everybody first sees the "write silently" step: participants add entries (Epic 4) and other people's entries are hidden.
2. The Facilitator sees a counter such as "5 of 7 have added something" (not who, not what).
3. When the Facilitator decides it is time, they use the reveal control: all entries of the phase appear for everyone at once, labeled with the authors' names, and the step changes to "reveal".
4. The Facilitator moves on to the "discuss" step. Each step has its own instruction and its own timer.

### Journey 3: Facilitator reveals check-in entries
1. In the Check-in phase, participants write their responses (Epic 4); other people's responses are hidden and the Facilitator sees the same counter.
2. The Facilitator uses the reveal control and all check-in responses appear at once, labeled with names.

### Journey 4: Review of previous action items
1. The Facilitator moves to the "Review of previous action items" phase.
2. All participants see a prompt to open the documentation from the last retro (e.g., in Confluence or Miro) and review its action items together.
3. The tool stores and imports nothing; the Facilitator moves on when the review is done.

### Journey 5: Facilitator goes back
1. The Facilitator realizes that a phase ended too early (e.g., a participant still wants to add notes).
2. They go back to the earlier phase, and everybody follows; earlier content is still there and still editable.
3. They move forward again.

### Journey 6: Timer runs out
1. The suggested time for a phase or step ends while the group is still working.
2. On every device the timer shows that the time is over and a short sound plays (unless muted on that device or by the Facilitator); nothing is blocked and the phase does not change.
3. The Facilitator continues, or moves to the next phase.

### Journey 8: Late entries after the reveal
1. After the Facilitator has revealed, a participant adds another entry.
2. The entry is visible to everybody immediately, labeled with the participant's name.

### Journey 7: Facilitator drops out
1. The Facilitator's browser closes or loses connection.
2. Participants see "Facilitator offline" and the timer is marked as not synchronized.
3. The Facilitator resumes on the same device (Epic 1); phase, step and timer are restored. There is no handover to another participant in v1.

## Acceptance Criteria
- AC-1 (FR-3.1): Given a started session, then the phases appear in this fixed order: Check-in, Review of previous action items, Retrospective, Discussion notes, Action items, Check-out.
- AC-2 (FR-3.2): Given a started session, when the Facilitator moves to the next or previous phase, then all connected participants see the same phase without reloading.
- AC-3 (FR-3.2): Given a participant who is not the Facilitator, then they cannot change the phase, step or timer, and cannot use the reveal control.
- AC-4 (FR-3.2): Given a participant who joins late or reconnects, then they see the current phase, step and timer immediately.
- AC-5 (FR-3.2): Given a Facilitator who has moved on to a later phase, when they go back to an earlier phase, then all participants follow, earlier content is still there, and it can still be edited.
- AC-6 (FR-3.3): Given any phase, then the Facilitator sees the full instruction (what to do, what to say, how long) written for a non-expert, and participants see a one-line "what we are doing now".
- AC-7 (FR-3.3): Given the Retrospective phase, then the chosen format's facilitation tips are shown to the Facilitator in addition to the generic instruction.
- AC-8 (FR-3.4): Given a chosen total time (30 / 50 / 80 min) and a format, then each phase shows a suggested time taken from the format's time split for that total time.
- AC-9 (FR-3.4): Given a phase, when the Facilitator starts, pauses or resets the timer, then all participants see the same remaining time.
- AC-10 (FR-3.4): Given a running timer, when it reaches zero, then all participants see that the time is over and hear a short sound, and no work is blocked and no phase or step is changed automatically.
- AC-11 (FR-3.4): Given a participant who reconnects while a timer is running, then they see the correct remaining time.
- AC-12 (FR-3.5): Given the "Review of previous action items" phase, then a prompt to open the documentation from the last retro is shown, and no action items are stored, imported or required by the tool.
- AC-13 (FR-3.6): Given a running session, then the Facilitator sees the current phase, the remaining phases, and time used versus planned.
- AC-14 (FR-3.7): Given hidden entries (Epic 4) in the Check-in or Retrospective phase, when the Facilitator uses the reveal control, then all entries of that phase become visible to all participants at once, labeled with the author's name; non-Facilitators have no reveal control.
- AC-15 (FR-3.8): Given the Retrospective phase, then it has three steps in this order: write silently (entries hidden), reveal, discuss; each step has its own instruction and timer.
- AC-16 (FR-3.9): Given the Facilitator is offline (Epic 1), then participants see "Facilitator offline", the timer is shown as not synchronized instead of counting as if it were authoritative, and when the Facilitator resumes, phase, step and timer are restored.
- AC-17 (FR-3.10): Given the write step of the Check-in or Retrospective phase, then the Facilitator sees a counter of participants who have added at least one entry (e.g., "5 of 7"), and does not see who they are or what they wrote.
- AC-18 (FR-3.11): Given the tool, then no reassignment of the Facilitator role is offered in v1, and the limitation (resume on the same device only) is documented in the Facilitator guidance.
- AC-22 (FR-3.4): Given the timer sound, then every participant can mute it on their own device (sound on by default), and the Facilitator can mute it for everybody.
- AC-23 (FR-3.8): Given a format and a total time, then the Retrospective phase shows a suggested time for each of its three steps taken from the format's time split; a custom format uses a generic default split.
- AC-24 (FR-3.12): Given a phase or step that was left with time remaining, when the Facilitator goes back to it, then it shows its previous remaining time, paused, and the Facilitator can reset it; no timer starts on its own.
- AC-25 (FR-3.13): Given a revealed phase, when a participant adds an entry afterwards, then it is visible to everybody immediately, labeled with their name, without a second reveal.
- AC-19 (NFR-1): Given a first-time Facilitator with no coaching background, then they can complete the whole flow using only the on-screen guidance.
- AC-20 (NFR-2): Given a phase change or timer action by the Facilitator, then it is visible on participants' devices without noticeable delay.
- AC-21 (NFR-5): Given the instruction texts, when they are edited in the data files only, then the new texts appear without any functional change.

## Functional Requirements
- FR-3.1: Every session follows this fixed order: Check-in, Review of previous action items, Retrospective, Discussion notes, Action items, Check-out.
- FR-3.2: The Facilitator controls navigation. They move everyone forward and back freely between all six phases, and earlier content stays and stays editable; participants see the current phase automatically. Only the Facilitator can change the phase.
- FR-3.3: Each phase shows on-screen facilitation instructions written for a non-expert. The Facilitator sees the full instruction (what to do, what to say, how long) and the chosen format's facilitation tips in the retro phase; participants see a one-line "what we are doing now".
- FR-3.4: Each phase has a suggested time, taken from the chosen format's time split for the chosen total time (30 / 50 / 80 min). The Facilitator can start, pause and reset a visible timer that all participants see. Timers are advisory: they never block work and never change the phase or step automatically. When a timer reaches zero, every device shows that the time is over and plays a short sound. Every participant can mute the sound on their own device (on by default), and the Facilitator can mute it for everybody.
- FR-3.5: The "Review of previous action items" phase is a reminder only: it prompts the team to open their documentation from the previous retro (e.g., Confluence/Miro) and review it together. Nothing is stored or imported by the tool.
- FR-3.6: The Facilitator sees an overview of progress (current phase, remaining phases, time used versus planned).
- FR-3.7: The Facilitator can reveal participants' hidden entries with one reveal action that shows all entries of the current phase at once. The entry content and the hiding behavior come from Epic 4.
- FR-3.8: The Retrospective phase has three steps: write silently (entries hidden), reveal, discuss. Each step has its own instruction and timer, with the suggested time for each step taken from the format's time split (custom formats use a generic default split).
- FR-3.9: Phase, step and timer state are part of the shared session state, are restored when the Facilitator resumes (Epic 1), and are shown as not synchronized while the Facilitator is offline.
- FR-3.10: During a write step, the Facilitator sees a counter of how many participants have added something (e.g., "5 of 7"), without names or content.
- FR-3.12: Each phase and step keeps its own remaining time. When the Facilitator goes back to one, it resumes paused with its previous remaining time, and the Facilitator can reset it. No timer starts on its own.
- FR-3.13: Entries added after the reveal are visible to everybody immediately, labeled with the author's name, without a second reveal.
- FR-3.11: Reassigning the Facilitator role is not part of v1 (roadmap requirement 3.8). The Facilitator can resume on the same device (Epic 1), and this limitation is documented in the Facilitator guidance.

## Non-Functional Requirements
- NFR-1: A first-time facilitator can complete the flow using only on-screen guidance.
- NFR-2: Phase changes and timer state appear for all participants with no noticeable delay; the timer needs no per-second traffic.
- NFR-3: The phase flow, instructions and timers are fully usable on mobile browsers (participants).
- NFR-4: The instructions are written in plain English for people with no coaching background.
- NFR-5: Instruction texts live in one data file for the fixed phases (id, title, instruction text, default time share), checked against a type, and can be edited without changing the tool's functionality. Format-specific tips stay in the format data (Epic 2).

## Decision Log
### Cycle 1
- Q: How are timers kept in sync across devices? → A: The host stores status, start time, duration and remaining time; each device calculates the remaining time itself, and only start/pause/reset are sent
- Q: How should the Facilitator role be reassigned (roadmap requirement 3.8)? → A: No reassignment in v1; document the limitation (this removes roadmap requirement 3.8 from v1; see FR-3.11)
- Q: What can the Facilitator do with navigation? → A: Move forward and back freely between all six phases; earlier content stays and stays editable
- Q: Does the Retrospective phase have steps of its own? → A: Yes, three steps: write silently (entries hidden), reveal, discuss; the timer and instruction follow the step
- Q: How much is revealed at once? → A: All entries of the current phase at once, with one reveal action
- Q: What happens when a timer reaches zero? → A: A visual signal plus a short sound on every device (chosen instead of the recommended visual-only signal with "add 5 minutes")
- Q: Who sees the facilitation instructions? → A: The Facilitator sees the full instructions and tips; participants see a one-line "what we are doing now"
- Q: Should the Facilitator see how many participants have finished writing? → A: Yes: a counter such as "5 of 7 have added something" (no names, no content)
### Cycle 2
- Q: How can people control the timer sound? → A: Every participant has a mute toggle on their own device (sound on by default), and the Facilitator can mute the sound for everybody
- Q: How is the time for the Retrospective phase divided between its three steps? → A: The format's time split (Epic 2) contains a time for each of the three steps; custom formats use a generic default split
- Q: What happens to a phase's timer when the Facilitator goes back? → A: Each phase and step keeps its own remaining time; going back resumes it paused, and the Facilitator can reset it
- Q: What happens to entries added after the reveal? → A: They are visible to everybody immediately, labeled with the name

## Open Questions

None — confidence reached 90%.
