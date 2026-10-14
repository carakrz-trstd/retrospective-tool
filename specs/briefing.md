# Retrospective Tool: Project Briefing

## 1. Purpose
Teams often cancel their retrospective when their Agile Coach is out of office. This tool removes that barrier: **anyone on the team, regardless of role, can facilitate a complete retrospective** with guidance built in. The tool is a one-stop shop that covers format selection, the session flow, collaboration and documentation.

- **Audience:** internal teams only (small teams of 3-8, a few teams in total).
- **Not in scope:** public or commercial use, user accounts, long-term storage of sessions.

## 2. Key Decisions (from discovery)

| Topic | Decision |
|---|---|
| Collaboration | Each participant on their own device, live sync |
| Hosting | GitHub Pages (static site, no server) |
| Live sync | Peer-to-peer via WebRTC. The facilitator's browser is the host; participants join via link or code |
| Access | Public URL accepted. The tool must store and send no data to a server, and shows an "internal use" notice |
| Entry visibility | Hidden until the facilitator reveals them, then shown labeled with the author's name |
| Facilitation | Guided steps with timers, advanced by the facilitator |
| Host resilience | Auto-save to local browser storage, so the facilitator can reopen and resume with the same link and participants auto-reconnect |
| Format library | Curated ~10-12 formats from funretrospectives.com, plus custom categories |
| Export | Markdown (.md), rich text/HTML (copy to clipboard, for Confluence), CSV (for Miro import) |
| Scale | Small teams (3-8 people), few teams, so no heavy infrastructure |

## 3. Users and Roles
- **Facilitator:** the session creator by default. Controls the flow (advance phase, start timer, reveal entries). Can be passed to someone else if needed (see open questions).
- **Participant:** enters name and role on joining, and can contribute to check-in, retro, notes, action items and check-out.

## 4. User Flow

### 4.1 Pre-session setup (facilitator)
1. **Short questionnaire (3-5 questions)** to determine the format to suggest:
   - Team mood today (e.g., energized, neutral, tired, tense)
   - Goal (have fun, bond as a team, reflect on the period since the last retro, reflect on a specific project, etc.)
   - Available time (30 / 50 / 80 min)
   - Depth (lean vs. extensive)
   - Optional: team familiarity with retros / remote vs. in-room
2. **Format suggestion:** the tool recommends a format (with 1-2 alternatives) from the curated library. The facilitator can accept it, pick another, or **create custom categories/columns**.
3. **Session creation:** the facilitator enters their own name and role and receives a join link/code to share.
4. **Participants join:** each enters a name and role. A lobby shows who has joined.

### 4.2 Session phases
Each phase has short on-screen facilitation instructions, a suggested timer scaled to the chosen duration, and facilitator-controlled navigation.

1. **Check-in:** short warm-up question; each participant writes a response labeled with their name.
2. **Review of previous action items:** a prompt only. Action items are not stored in the tool, so the team is reminded to open their documentation from the last retro (e.g., Confluence/Miro) and review it together.
3. **Retrospective:** the chosen format's columns/prompts. Participants add entries individually (hidden until the facilitator reveals them). Optional grouping and dot-voting are possible future additions (see section 8).
4. **Discussion notes:** shared area to document the discussion.
5. **Action items:** a list of actions, each with a description and an **owner** (chosen from the participants), and optionally a due date.
6. **Check-out / exit survey:** quick feedback on (a) how the retro went and (b) how the tool itself worked (e.g., a 1-5 rating plus a free-text comment).

### 4.3 End of session
- Auto-generated **documentation** covering: date, participants and roles, chosen format, check-in responses, retro entries (labeled with names), discussion notes, action items with owners, and check-out results.
- **Export options:** Markdown file, rich-text/HTML copy-to-clipboard (for Confluence), CSV (for Miro import).
- **Warning (prominent, shown at the end and before leaving):** the session is not saved. The documentation must be saved or downloaded to the local device.

## 5. Functional Requirements
1. Create a session; the creator becomes Facilitator by default.
2. Join a session via link or code; enter name and role.
3. Pre-session questionnaire (3-5 questions) producing a format recommendation.
4. Curated library of ~10-12 formats (name, description, columns/prompts, suggested durations, mood/goal tags, facilitation tips).
5. Custom format/category creation by the facilitator.
6. Fixed session structure: Check-in, Previous actions reminder, Retro, Notes, Action items, Check-out.
7. Facilitator-controlled phase navigation and timers.
8. Individual entries per participant, hidden until revealed, labeled with the author's name afterwards.
9. Real-time sync of session state across all participants (P2P).
10. Local auto-save for the facilitator and rejoin/reconnect for participants.
11. Documentation generator with Markdown, rich-text/HTML and CSV (Miro) export.
12. "Not saved" warnings.
13. "Internal use" notice.

## 6. Non-Functional Requirements
- **Privacy:** no backend, no analytics, no accounts. Session data exists only in participants' browsers, which fits the "session is not saved" principle. A public signaling/STUN service for WebRTC is the only external dependency (to be confirmed as acceptable).
- **Low barrier:** no installation or sign-up; works in modern desktop browsers and is usable on mobile for participants.
- **Simplicity:** a first-time facilitator with no coaching background should be able to run a session using only the on-screen guidance.
- **Performance:** designed for 3-8 concurrent participants per session; a few sessions in parallel.
- **Maintainability:** formats stored as data (JSON), so the library can be extended without code changes.

## 7. Suggested Technical Direction (to be confirmed)
- Static single-page app deployed to GitHub Pages (e.g., TypeScript with a lightweight framework and Vite).
- P2P sync via WebRTC using a library such as PeerJS or Trystero, with the facilitator as the authoritative host.
- Local persistence via localStorage/IndexedDB for host draft recovery, cleared when the session is exported or ended.
- Export generation fully client-side.

**Key risk:** in P2P, the session depends on the host's browser. Mitigation: local auto-save and rejoin. Corporate firewalls can also block WebRTC, so test on company networks early and consider a TURN fallback if needed.

## 8. Out of Scope (v1) / Possible Later
- Saving sessions or action items across retros (the review step is a reminder only)
- Anonymous mode, voting/dot-voting, grouping of similar entries, trend analytics
- Direct Confluence/Miro API integration (v1 uses file/clipboard export)
- Large format library (25+) and multi-language support

## 9. Open Questions / Assumptions
- **Language:** assumed English only. Confirm whether German or other languages are needed.
- **Host handover:** passing the facilitator role to another participant was not chosen as a resilience mechanism. Decide whether the role can still be reassigned manually.
- **Signaling/STUN/TURN:** confirm that using a public WebRTC signaling service is acceptable to Trusted Shops IT/security, and test WebRTC on the corporate network.
- **Public URL:** accepted, but confirm that no company-identifying or sensitive defaults ship in the repo.
- **Format selection:** which ~10-12 formats to include (to be curated from funretrospectives.com, with attribution/licence check).
- **Exit survey:** the results are only part of that session's documentation. Should the tool-feedback part reach the coach in some way (e.g., a link to a feedback form)? Currently nothing is collected centrally.
- **Branding/design:** no requirements given. Assume a clean, neutral look.
- **Timers:** whether they are advisory only or visibly enforce phase end (assumed advisory).

## 10. Success Criteria
- A team with no coach can run a complete retrospective, from setup to export, in the time they selected.
- Setup (questionnaire to session start) takes under 5 minutes.
- Every participant can contribute on their own device, with entries labeled by name.
- The exported documentation can be pasted into Confluence and imported into Miro without manual rework.
- Fewer cancelled retrospectives during coach absences.
