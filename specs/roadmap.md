# Retrospective Tool: Roadmap

Source: [briefing.md](briefing.md). This roadmap describes **requirements only**. Technology and architecture decisions are made later in the technical specs.

## Overview

| Epic | Title | Depends on | Wave |
|---|---|---|---|
| 1 | Session Lifecycle & Live Collaboration | none | 1 |
| 2 | Format Recommendation & Library | none | 1 |
| 3 | Guided Session Flow | Epic 1 | 2 |
| 4 | Participant Contributions | Epic 1 (uses Epic 2's format definition) | 2 |
| 5 | Documentation & Export | Epics 3 and 4 | 3 |

**Parallelism:**
- **Wave 1:** Epics 1 and 2 are independent and can be built at the same time.
- **Wave 2:** Epics 3 and 4 both need the session and live collaboration from Epic 1 and can be built at the same time. Epic 4 needs a *format definition* (the retro columns/prompts) from Epic 2. Until Epic 2 is finished, it can use a single built-in placeholder format with the agreed structure.
- **Wave 3:** Epic 5 needs the final content of Epics 3 and 4.

**Roles used below:** *Facilitator* (the session creator by default, controls the flow) and *Participant* (any team member, regardless of job role).

**Scope guardrails (from the briefing):** internal use only; teams of 3-8; no user accounts; no long-term storage of sessions; English only in v1.

---

## Epic 1 — Session Lifecycle & Live Collaboration

**Goal:** Anyone can start a session, invite teammates, and see the same shared session state in real time on their own devices, and the session survives interruptions.

### Functional requirements
- **1.1** A user can create a session. The creator is automatically the Facilitator and enters their own name and role.
- **1.2** The creator receives a join link and a short join code to share with the team.
- **1.3** A participant can join through the link or by entering the code. They enter their name and role (free text).
- **1.4** A lobby shows all joined participants with name and role, updating live as people join or leave. The Facilitator can start the session from the lobby.
- **1.5** All participants see the same shared session state in real time (phase, entries, notes, actions, etc.). Any later epic's content must be able to use this shared state.
- **1.6** Participants can join while the session is running (late joiners see the current state).
- **1.7** If a participant's connection drops or they reload, they automatically rejoin as the same person without losing their own entries.
- **1.8** The Facilitator's session is kept locally on their device, so if they close or reload the browser they can reopen it, resume the same session with the same link, and participants reconnect automatically.
- **1.9** Locally kept session data is removed when the session is ended or its documentation has been exported (see Epic 5).
- **1.10** The Facilitator can end the session for everyone.
- **1.11** An "internal use only" notice is visible to users.

### Non-functional requirements
- No accounts or sign-up; no installation.
- No session data is stored on, or sent to, a server operated for this tool. Any external service needed purely to connect participants is an open question to confirm with IT/security (see briefing section 9).
- Supports 3-8 participants per session and a few sessions in parallel.
- Works in modern desktop browsers; fully usable on mobile for participants.
- Connection behavior is to be tested on company networks early (risk from the briefing).

### Acceptance outline
- Three participants on three devices can join one session and all see each other in the lobby.
- A participant who reloads their browser returns as themselves.
- The Facilitator can close and reopen the browser and continue.

---

## Epic 2 — Format Recommendation & Library

**Goal:** The Facilitator answers a few questions and receives a well-fitting retrospective format, or defines their own.

### Functional requirements
- **2.1** Before creating a session, the Facilitator answers 3-5 questions. At minimum: team mood today, goal of the retro (e.g., have fun, bond as a team, reflect on the period since the last retro, reflect on a specific project), available time (30 / 50 / 80 min), and depth (lean vs. extensive). Optional additional question(s) such as team familiarity with retros or remote vs. in-room.
- **2.2** The tool recommends one format and 1-2 alternatives based on the answers, each with a short reason why it fits.
- **2.3** A curated library of about 10-12 formats, based on funretrospectives.com, is available. Each format has: name, description, columns/prompts for the retro, suggested durations/time split, mood/goal tags, and facilitation tips.
- **2.4** The Facilitator can browse the library, see format details, and select any format regardless of the recommendation.
- **2.5** The Facilitator can create a custom format by defining their own categories/columns (name and optional prompt per column) instead of, or based on, a library format.
- **2.6** The chosen format (library or custom) and the chosen time budget are handed over to session creation as the definition used throughout the session.
- **2.7** Formats can be added or edited without changing the tool's functionality (maintainability requirement).

### Non-functional requirements
- Completing the questionnaire and choosing a format takes under 5 minutes.
- Use of funretrospectives.com content respects attribution/licence (open question in the briefing).
- A first-time facilitator with no coaching background can understand the recommendation and the formats.

### Acceptance outline
- Different answer sets produce sensible, different recommendations (e.g., 30 min + tired + lean differs from 80 min + bonding + extensive).
- A custom format with three self-named columns can be used for a session.

---

## Epic 3 — Guided Session Flow

**Goal:** Someone with no facilitation experience can run the whole meeting by following the tool.

### Functional requirements
- **3.1** Every session follows this fixed order: Check-in, Review of previous action items, Retrospective, Discussion notes, Action items, Check-out.
- **3.2** The Facilitator controls navigation. They move everyone forward (and back) between phases; participants see the current phase automatically.
- **3.3** Each phase shows short on-screen facilitation instructions (what to do, what to say, how long), written for a non-expert. The retro phase also shows the chosen format's facilitation tips.
- **3.4** Each phase has a suggested time, scaled to the chosen total session time (30 / 50 / 80 min) and the format. The Facilitator can start, pause and reset a visible timer that all participants see. Timers are advisory (they do not block work when they end; assumption to confirm).
- **3.5** The **Review of previous action items** phase is a reminder only: it prompts the team to open their documentation from the previous retro (e.g., Confluence/Miro) and review it together. Nothing is stored or imported by the tool.
- **3.6** The Facilitator sees an overview of progress (current phase, remaining phases, time used versus planned).
- **3.7** The Facilitator can reveal participants' hidden entries at the right moment in a phase (the reveal control is part of the flow; entry content comes from Epic 4).
- **3.8** The Facilitator role can be reassigned to another participant if needed (open question in the briefing; included so a facilitator who drops out or has to leave can be replaced).

### Non-functional requirements
- A first-time facilitator can complete the flow using only on-screen guidance.
- Phase changes and timer state appear for all participants with no noticeable delay.

### Acceptance outline
- A full dummy session can be stepped from Check-in to Check-out by the Facilitator, with all participants following along.
- Timer values change when the total duration is changed.

---

## Epic 4 — Participant Contributions

**Goal:** Every participant can contribute individually in every relevant phase, and everything is attributable and visible to the group at the right time.

### Functional requirements
- **4.1** **Check-in:** a short warm-up question is shown. Each participant writes their response.
- **4.2** **Retrospective:** the board shows the columns/prompts of the chosen format. Each participant can add, edit and delete their own entries in any column.
- **4.3** **Hidden until reveal:** during check-in and the retrospective, other participants' entries are not visible until the Facilitator reveals them. A participant always sees their own entries. Once revealed, each entry is labeled with its author's name.
- **4.4** **Discussion notes:** a shared area where the group can write and edit notes about the discussion. The Facilitator can choose a note taker, but any participant can contribute.
- **4.5** **Action items:** participants can add action items, each with a description and an owner chosen from the participants, and optionally a due date. Action items can be edited and removed.
- **4.6** **Check-out / exit survey:** each participant answers quick questions about (a) how they found the retro and (b) how they found the tool itself (e.g., a 1-5 rating plus free-text comment). Results are shown to the group as an aggregate with individual comments.
- **4.7** All contributions are shared in real time using the shared session state from Epic 1 and are not lost if a participant reconnects.

### Non-functional requirements
- Entry input is quick and works well on mobile.
- The retro board stays usable with 8 participants and many entries.

### Acceptance outline
- Participant A cannot see Participant B's retro entries until the Facilitator reveals them; afterwards the entries show B's name.
- An action item can only be assigned to a person who is in the session.
- Exit survey results show up for the group.

---

## Epic 5 — Documentation & Export

**Goal:** At the end of the session the team gets a complete record they can keep, and is clearly warned that nothing is saved by the tool.

### Functional requirements
- **5.1** At the end of the session, documentation is generated automatically, containing: date, participants and roles, chosen format, check-in responses, retrospective entries (labeled with names), discussion notes, action items with owners (and due dates), and check-out results.
- **5.2** The documentation can be previewed before export.
- **5.3** Export as a **Markdown** file (download).
- **5.4** Export as **rich text/HTML** copied to the clipboard, so that it can be pasted into Confluence with formatting preserved. A downloadable HTML file is also available.
- **5.5** Export as **CSV** suitable for importing into Miro (e.g., entries as sticky notes with column/category and author).
- **5.6** A prominent warning explains that the session is not saved by the tool and the documentation must be saved or downloaded to the local device. It is shown on the documentation screen and again when someone tries to leave or close the session without having exported.
- **5.7** The tool shows which exports have been completed. Once the documentation has been exported (or the user confirms leaving), locally kept session data is removed (see 1.9).
- **5.8** Any participant (not only the Facilitator) can open and export the documentation on their own device.

### Non-functional requirements
- Export is generated on the user's device; no content is sent anywhere.
- The exports can be pasted into Confluence and imported into Miro without manual rework (success criterion from the briefing).

### Acceptance outline
- A completed session produces a Markdown file, a Confluence-ready paste, and a Miro-importable CSV containing the same content.
- Closing the tab before exporting triggers the warning.

---

## Coverage check against the briefing

| Briefing functional requirement | Epic |
|---|---|
| 1 Create a session; creator is Facilitator | 1 (1.1) |
| 2 Join via link/code with name and role | 1 (1.2, 1.3) |
| 3 Pre-session questionnaire and recommendation | 2 (2.1, 2.2) |
| 4 Curated library of ~10-12 formats | 2 (2.3, 2.4) |
| 5 Custom format/categories | 2 (2.5) |
| 6 Fixed session structure | 3 (3.1, 3.5), 4 (4.1-4.6) |
| 7 Facilitator-controlled navigation and timers | 3 (3.2-3.4, 3.6) |
| 8 Individual entries, hidden until reveal, labeled by name | 4 (4.1-4.3), 3 (3.7) |
| 9 Real-time sync | 1 (1.5, 1.6), 4 (4.7) |
| 10 Local auto-save and reconnect | 1 (1.7-1.9) |
| 11 Documentation generator and exports | 5 (5.1-5.5) |
| 12 "Not saved" warnings | 5 (5.6, 5.7) |
| 13 "Internal use" notice | 1 (1.11) |

| Briefing non-functional requirement | Epic |
|---|---|
| Privacy (no server-side storage) | 1, 5 |
| Low barrier / mobile participants | 1, 4 |
| Simplicity for first-time facilitators | 2, 3 |
| Performance for 3-8 people | 1, 4 |
| Maintainability (formats as data) | 2 (2.7) |

Out of scope for v1 (as in the briefing): saving sessions or action items across retros, anonymous mode, voting/grouping, analytics, direct Confluence/Miro API integration, 25+ formats, multi-language.
