# Usability check: guided session flow (Epic 3, T-11)

**Status: NOT DONE.** This check needs a real person and cannot be run by the build. The texts in
`src/flow/data/phases.json` are a first draft written without this check. Until the table below is
filled in, AC-19, NFR-1 and NFR-4 of the PRD are not confirmed.

## How to run the check

1. Pick one person who has **never facilitated a retrospective** and has no coaching background.
2. Give them the join link of a session you created (format: Start-Stop-Continue, 50 minutes) and
   two or three colleagues as participants. Do not explain the tool. Do not coach during the session.
3. They run the session from Check-in to Check-out using only the on-screen texts and the
   "Facilitator guide" button.
4. Write down every moment where they hesitated, asked a question, or did the wrong thing.
5. Afterwards, ask which texts they found unclear.

## Result

| Field                                      | Value |
| ------------------------------------------ | ----- |
| Date                                       |       |
| Facilitator (role, experience with retros) |       |
| Participants                               |       |
| Reached Check-out without help? (yes/no)   |       |
| Time used in total                         |       |
| Needed help from the observer (how often)  |       |

## Texts that were unclear

| Where (stop / screen) | Text as shown | What was unclear | Proposed new text |
| --------------------- | ------------- | ---------------- | ----------------- |
|                       |               |                  |                   |

## Follow-up

- [ ] Texts in `src/flow/data/phases.json` adjusted according to the table above
- [ ] `npm test` passes after the change (the phase text tests check structure, not wording)
