# PRD: Epic 1 — Session Lifecycle & Live Collaboration

Confidence: 92%

## Overview
**Goal:** Anyone on a team can start a retrospective session, invite teammates, and see the same shared session state in real time on their own devices. The session survives interruptions (reloads, dropped connections, the facilitator closing their browser).

**In scope:**
- Creating a session (creator = Facilitator, with name and role)
- Join link and join code
- Joining with name and role
- Lobby with live participant list and a Start action
- Real-time shared session state usable by all later epics
- Late join
- Automatic rejoin of participants
- Local auto-save and resume for the Facilitator
- Cleanup of locally kept data when the session ends
- Ending the session for everyone
- "Internal use only" notice

**Out of scope (other epics):**
- Format questionnaire, library and custom formats (Epic 2)
- Phases, timers, facilitation instructions, reveal control, Facilitator reassignment (Epic 3)
- Content entry: check-in, retro entries, notes, action items, survey (Epic 4)
- Documentation and export, "not saved" warnings, export-triggered cleanup (Epic 5)

**Dependencies:** none. Epics 3 and 4 build on the shared session state defined here. Epic 2 hands a chosen format and time budget to session creation (see FR-1.1).

**Given constraints (from the briefing and decisions):**
- Hosted as a static site on GitHub Pages; no server operated for this tool stores or processes session content.
- The Facilitator's browser is the host of the live session; participants connect to it using PeerJS (WebRTC) with its public signaling broker. The signaling broker carries only connection metadata, never session content. A TURN fallback is planned only if the early company-network test fails (see NFR-5).
- The host's state is authoritative. Participants send their changes to the host, which applies them and sends snapshots and updates to everyone.
- No accounts or sign-up.
- Public URL accepted.
- Teams of 3-8; a few sessions in parallel.
- Frontend: TypeScript + Vite + Preact, deployed to GitHub Pages through a GitHub Actions workflow.
- Local data (Facilitator session, participant identity and own entries) is kept in browser localStorage, one versioned key per role, written on every change.
- The Facilitator can resume only on the same browser and device that holds the session's local data (no session export/import in v1).
- Connection helper servers: public STUN only for v1, kept configurable; a company-provided TURN is added only if the early company-network test fails.

**Flag for later (not blocking): what to ask IT/security if needed**
- Run the early company-network test first (NFR-5): a simple PeerJS connection between two company laptops on the office network.
- If it works, ask: "May company laptops connect to the PeerJS public broker and a public STUN server? Only IP addresses and connection details are exchanged, no session content (names, roles, entries, notes)."
- If it fails (firewall blocks WebRTC or WebSocket connections), ask IT to allow those connections, or to provide a TURN relay. A TURN relay passes all session traffic (encrypted) through a server, so it needs more careful approval.
- Not expected to need approval: GitHub Pages hosting and keeping session data in browsers only. This is unconfirmed; check company policy.

## User Journeys
### Journey 1: Facilitator creates a session
1. The Facilitator opens the tool and sees the "internal use only" notice.
2. They start a new session (after choosing a format in Epic 2, or with a placeholder format until Epic 2 exists).
3. They enter their name and role.
4. The tool creates the session and shows the join link and a short join code, each with a copy action.
5. The Facilitator is shown in the lobby as the first participant, marked as Facilitator.

### Journey 2: Participant joins
1. The participant opens the join link, or opens the tool and enters the join code.
2. They enter their name and role. If they have joined before on this device, name and role are pre-filled and editable, and a "forget me" link clears the remembered values.
3. They land in the lobby and see everyone who has joined. The Facilitator and the other participants see the new person appear immediately.
4. If another participant already uses the same name, the new participant is shown with a distinguishing suffix (e.g. "Sam (2)").

### Journey 3: Starting the session
1. The Facilitator sees the live lobby list. If more than 8 people have joined, they see a soft warning.
2. They press Start.
3. All participants move from the lobby into the session at the same time.

### Journey 4: Late join
1. After the session has started, a team member opens the join link and enters name and role.
2. They land directly in the current state of the session (current phase and all content that is visible to them).

### Journey 5: Participant connection drops or reloads
1. A participant's connection drops or they reload the page.
2. The tool shows a "reconnecting" status.
3. When the connection is back, they are the same participant as before, with their own entries intact, and see the current session state.

### Journey 6: Facilitator closes the browser and resumes
1. The Facilitator closes or reloads their browser mid-session.
2. Participants see a "Facilitator offline" status, keep the last known state, and can keep writing their own entries, which are kept locally. After 15 minutes offline they also see a hint to copy their own entries and a "Leave session" option.
3. The Facilitator reopens the tool on the same device and is offered to resume the session.
4. They resume with the same join link; participants reconnect automatically, their locally written entries are sent to the Facilitator, and everything is restored.
5. If the Facilitator opens the same session in a second tab or window of the same browser, the first tab stays host and the second tab is offered a "take over" option, which makes the first tab read-only.

### Journey 7: Facilitator removes a participant
1. The Facilitator sees a participant in the lobby or session that should not be there (e.g. an unwanted join through the shared link).
2. They choose "remove" next to that participant and confirm.
3. The removed person sees a message that they were removed from the session and cannot rejoin with the same token. Their entries are no longer part of the session.

### Journey 8: Ending the session
1. The Facilitator ends the session.
2. Everyone is told that the session has ended.
3. Session data kept locally on each device is removed once that device has finished with the session (Epic 5 defines when documentation export must happen first).

## Acceptance Criteria
- AC-1 (FR-1.1): Given a user starts a new session and enters a name and role, when the session is created, then they appear in the lobby marked as Facilitator.
- AC-2 (FR-1.2): Given a created session, when the Facilitator views the session, then a join link and a short join code are shown, each with a copy action. The link carries the session identifier in the URL fragment and the session identifier is random and unguessable.
- AC-3 (FR-1.3): Given a valid join link or code, when a participant enters name and role, then they are added to the session and see the lobby.
- AC-4 (FR-1.3): Given an invalid or unknown code, or a session that has ended, when someone tries to join, then they see a clear message that the session cannot be found.
- AC-5 (FR-1.3): Given the join form, when name or role is left empty, then joining is blocked with a message.
- AC-6 (FR-1.4): Given three devices in one session, when a fourth person joins or one leaves, then the lobby list updates on all devices without reload.
- AC-7 (FR-1.4): Given the lobby, when the Facilitator presses Start, then all connected participants move into the session; a non-Facilitator cannot start it.
- AC-8 (FR-1.5): Given a change to shared session state on one device, when it is applied, then all connected devices show it in real time, and the change was processed by the Facilitator's browser first.
- AC-9 (FR-1.6): Given a started session, when a new participant joins, then they see the current state immediately.
- AC-10 (FR-1.7): Given a participant who has made entries, when they reload or lose and regain connection, then they return as the same person (recognized by a token stored on their device) with their own entries intact and without re-entering name and role.
- AC-11 (FR-1.7): Given a participant who is disconnected, when the others look at the participant list, then the participant is shown as offline and returns to online when reconnected, without a duplicate being created.
- AC-12 (FR-1.8): Given a running session, when the Facilitator closes or reloads their browser and reopens the tool on the same device, then they are offered to resume, and resuming restores the session and the same join link works.
- AC-13 (FR-1.8, FR-1.12): Given the Facilitator is offline, when participants view the session, then they see a clear "Facilitator offline" status, can keep writing their own entries (kept locally), and once the Facilitator resumes they reconnect automatically and their entries are sent to the Facilitator.
- AC-14 (FR-1.9): Given a session that has ended, when the person leaves the documentation screen after at least one export or after confirming that they want to leave without exporting (Epic 5), then the data kept locally for that session is removed on that device; it is not removed after each export.
- AC-23 (FR-1.9): Given locally kept data for a session that was never ended or left, when 24 hours have passed, then it is removed automatically.
- AC-24 (FR-1.13): Given a Facilitator with the session open in one tab, when they open the same session in a second tab of the same browser, then the second tab offers "take over"; after taking over, the first tab is read-only and only one tab acts as host.
- AC-25 (FR-1.8): Given a session started on one device, when the Facilitator opens the tool on a different browser or device, then no resume option is offered for that session.
- AC-27 (FR-1.14): Given a person who joined a session before on this device, when they join another session, then name and role are pre-filled and editable, and "forget me" removes the remembered values from the device.
- AC-28 (FR-1.15): Given the Facilitator has been offline for 15 minutes, when a participant looks at the session, then they see a hint to copy their own entries and a "Leave session" option, and their entries are still kept.
- AC-29 (FR-1.16): Given a participant in the session, when the Facilitator removes them, then they are shown a removal message, are disconnected, and cannot rejoin with the same token; non-Facilitators have no remove action.
- AC-30 (FR-1.16): Given a removed participant, when others view the participant list, then the removed person no longer appears.
- AC-31 (NFR-11): Given the connection service used for signaling, when it is changed in the settings, then the session logic works without code changes.
- AC-26 (FR-1.2): Given a created session, then the join code consists of 6 characters from an alphabet without look-alike characters (no 0/O, 1/I/l), and entering it is case-insensitive.
- AC-15 (FR-1.10): Given a running session, when the Facilitator ends it, then all connected participants are informed and no further changes are possible.
- AC-16 (FR-1.11): Given any screen of the tool before and during a session, then an "internal use only" notice is visible or reachable.
- AC-17 (NFR-1): Given a session, then no session content is sent to, or stored on, any server operated for this tool.
- AC-18 (NFR-4): Given a session with 8 participants, then joining, lobby updates and shared state changes remain responsive.
- AC-19 (NFR-3): Given a participant on a mobile device, then they can join, see the lobby and participate.
- AC-20 (FR-1.3): Given two participants with the same name, when both are in the session, then they appear with distinguishing suffixes and their entries remain distinguishable.
- AC-21 (FR-1.4): Given a lobby with more than 8 participants, then the Facilitator sees a soft warning and nobody is refused.
- AC-22 (FR-1.5): Given hidden entries (Epic 4), when state is sent to a participant, then entries of others that have not been revealed are not part of what that participant's device receives.

## Functional Requirements
- FR-1.1: A user can create a session. The creator is automatically the Facilitator and enters their own name and role, and can enter an optional session title (e.g., team or project name) that is used in the documentation (Epic 5). Session creation accepts a chosen format and time budget from Epic 2 (a placeholder until Epic 2 exists).
- FR-1.2: The creator receives a join link (session ID in the URL fragment) and a short join code of 6 characters from an unambiguous alphabet (no look-alike characters), entered case-insensitively, that maps to the session, each with a copy action. The session ID is random and unguessable and is kept in the Facilitator's local data.
- FR-1.3: A participant can join through the link or by entering the code, entering name and role (free text, both required). Each participant receives a random token that is stored on their device and presented on every reconnect. Duplicate names are allowed and shown with a distinguishing suffix. Invalid, unknown or ended sessions give a clear message.
- FR-1.4: A lobby shows all joined participants with name, role and online status, updating live. Only the Facilitator can start the session. There is no hard participant limit; the Facilitator sees a soft warning above 8 participants.
- FR-1.5: All participants see the same shared session state in real time. The Facilitator's browser is authoritative: participants send their changes to it, it applies them, and it sends full snapshots on join or reconnect and updates afterwards. It withholds other people's unrevealed entries. The shared state is extensible, so later epics can add their content to it.
- FR-1.6: Participants can join while the session is running and see the current state.
- FR-1.7: A participant who loses connection or reloads automatically rejoins as the same person (matched by their token), keeping their own entries.
- FR-1.8: The Facilitator's session is kept locally, so after closing or reloading they can resume the same session on the same browser and device with the same link; participants reconnect automatically. Participants see a "Facilitator offline" status meanwhile.
- FR-1.9: Locally kept session data is removed when the session has ended and the person leaves the documentation screen after at least one export or after confirming that they want to leave without exporting (Epic 5). Data of sessions that were never ended or left is removed automatically after 24 hours.
- FR-1.10: The Facilitator can end the session for everyone. If entries are still hidden, the Facilitator is warned first and can reveal them; entries that stay hidden are not part of the documentation (Epic 5).
- FR-1.11: An "internal use only" notice is visible to users.
- FR-1.12: While the Facilitator is offline, participants keep the last known state and can keep writing their own entries, which are stored locally and sent to the Facilitator when it returns.
- FR-1.14: Name and role are remembered on the participant's device and pre-filled (editable) the next time they join; a "forget me" link clears them.
- FR-1.15: While the Facilitator is offline, participants see "Facilitator offline" and keep their own entries; after 15 minutes they also see a hint to copy their own entries and a "Leave session" option. The session is never ended automatically for participants.
- FR-1.16: The Facilitator can remove a participant. The removed person is shown a message, disconnected, and cannot rejoin with the same token; their own device keeps no access to the session.
- FR-1.13: If the same session is opened in a second tab or window of the Facilitator's browser, the first tab stays host and the second tab is offered a "take over" option that makes the first tab read-only.

## Non-Functional Requirements
- NFR-1: No session content is stored on, or sent to, a server operated for this tool; no accounts, no analytics. Any external service needed purely to connect participants is subject to IT/security confirmation.
- NFR-2: No installation or sign-up needed; works in modern desktop browsers.
- NFR-3: Fully usable by participants on mobile browsers.
- NFR-4: Supports 3-8 participants per session and a few sessions at the same time; state changes appear for others without noticeable delay.
- NFR-5: Connection behavior is to be validated on the company network early, because corporate firewalls may block the connection technique. If it fails there, a company-provided TURN relay is added as a fallback (which needs IT approval).
- NFR-11: Signaling uses a free third-party relay (PeerJS's public broker), which carries only connection metadata and no session content. It is kept behind a swappable interface so it can be replaced by a self-hosted or IT-provided service.
- NFR-10: The connection helper (STUN) servers are a replaceable setting, so they can be changed without code changes to the session logic.
- NFR-6: Connection state (connecting, online, reconnecting, Facilitator offline) is always visible to the user.
- NFR-7: The tool is in English only for v1.
- NFR-8: The tool is built with TypeScript, Vite and Preact, and deployed to GitHub Pages through a GitHub Actions workflow. The join link uses the URL fragment, because the static hosting cannot rewrite paths.
- NFR-9: Locally kept data is versioned so that later changes can be handled without breaking a running session.

## Decision Log
### Cycle 1
- Q: How should devices connect for live sync, given static hosting? → A: PeerJS with its public signaling broker, with a TURN fallback only if the company-network test fails (revised in Cycle 2 from raw WebRTC with self-built signaling; this also covers the signaling and stable host identity needs raised in Q9)
- Q: How is shared session state kept consistent? → A: Host-authoritative: participants send intents, the Facilitator's browser applies them, and sends snapshots and incremental updates
- Q: Where is the Facilitator's session and a participant's own data kept locally? → A: Browser localStorage, one versioned key per role, written on every change
- Q: How are the join link and code formed, and how is a returning participant recognized? → A: Random unguessable session ID kept in the Facilitator's local data; link uses the URL fragment; separate short human-friendly code; per-participant random token
- Q: What frontend stack and build approach should be used? → A: TypeScript + Vite + Preact, GitHub Pages via GitHub Actions
- Q: What can a participant do while the Facilitator is offline? → A: Participants can keep writing their own entries locally, sent when the Facilitator returns (replaces the read-only assumption; adds FR-1.12 and updates Journey 6, AC-13)
- Q: How should duplicate names in one session be handled? → A: Allow duplicates with a distinguishing suffix
- Q: What happens when more than 8 people try to join? → A: No hard limit; soft warning to the Facilitator above 8

### Cycle 2
- Q: Which connection-helper servers (ICE) should be used? → A: Public STUN only for v1, configurable, with company-provided TURN added only if the early company-network test fails
- Q: Can the Facilitator resume only on the same browser/device? → A: Same browser and device only, using the locally kept data
- Q: What happens if the Facilitator opens the same session in a second tab or window of the same browser? → A: Detect it, keep the first tab as host, and offer the second tab a "take over" option that makes the first tab read-only
- Q: When should locally kept session data be removed, besides when the session ends? → A: On session end once the person has exported or confirmed leaving (Epic 5), plus automatic removal of abandoned sessions after 24 hours
- Q: What should the short join code look like? → A: 6 characters from an unambiguous alphabet (no look-alike characters), case-insensitive

### Cycle 3
- Q: How does signaling work, given there is no backend and the same join link must survive a Facilitator reload? → A: A free third-party relay that we configure (PeerJS's public broker after the Q1 revision), kept behind a swappable interface, carrying only connection metadata
- Q: Should the tool remember a person's name and role on their device for next time? → A: Yes, pre-fill name and role on this device, editable, with a "forget me" link
- Q: What should participants see if the Facilitator stays offline for a long time? → A: Keep showing "Facilitator offline" and keep their own entries; after 15 minutes also show a hint to copy their entries and a "Leave session" option
- Q: Can the Facilitator remove a participant from the lobby or session? → A: Yes, a "remove" action; the removed person sees a message and cannot rejoin with the same token

## Open Questions

None — confidence reached 90%.

