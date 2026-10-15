# Manual check: Confluence paste and Miro import (Epic 5, T-12)

**Status: NOT DONE.** This check needs a real Confluence page, a real Miro board and Excel, which
the automated tests do not use. Until the results below are filled in, NFR-3 ("paste into Confluence
and import into Miro without manual rework") and the manual parts of AC-6 and AC-9 are not confirmed.

## How to run the check

1. Run a session (any format, 50 minutes) with two or three people and use entries with special
   characters: `*bold*`, `<b>x</b>`, `=SUM(A1)`, a text with a comma and a "quote", and one with a
   line break. Add a note, an action item with two owners and a due date, and the survey. End the
   session.
2. On the documentation screen use **Copy for Confluence** and paste into a new Confluence page.
3. Use **Download CSV for Miro**, import the file into a Miro board, and open the same file in Excel.
4. Fill in the tables and note every change that was needed.

## 1. Copy for Confluence

| Check                                                | Result | Notes / screenshot |
| ---------------------------------------------------- | ------ | ------------------ |
| Headings (title, sections, columns) keep their level |        |                    |
| Bulleted lists stay lists                            |        |                    |
| The action item table keeps its three columns        |        |                    |
| Special characters appear as typed (no formatting)   |        |                    |
| Line breaks inside an entry                          |        |                    |

## 2. CSV in Miro

| Check                                                | Result | Notes / screenshot |
| ---------------------------------------------------- | ------ | ------------------ |
| The columns are mapped as expected                   |        |                    |
| Every row becomes its own item                       |        |                    |
| Umlauts and emoji are shown correctly                |        |                    |
| The cell that started with `=` shows a leading quote |        |                    |

## 3. CSV in Excel (the file has no byte order mark)

| Check                                            | Result | Notes / screenshot |
| ------------------------------------------------ | ------ | ------------------ |
| Umlauts and emoji are shown correctly            |        |                    |
| The leading single quote in front of `=SUM(A1)`  |        |                    |
| Comma-separated columns are split into 6 columns |        |                    |

## Changes made as a result

- [ ] none needed
- [ ] (describe the change in `src/doc/*.ts`, and the test that now covers it)
