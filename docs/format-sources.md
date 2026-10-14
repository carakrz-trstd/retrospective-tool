# Format sources and attribution (T-12, manual check)

The 12 library formats are based on retrospective activities. The PRD says they come from
[funretrospectives.com](https://www.funretrospectives.com/) and that the names are to be confirmed. This document
records what could be checked on **2026-10-14** with web searches restricted to funretrospectives.com. It is a
first check, not a licence review.

## Result per format

| Format in the tool  | On funretrospectives.com?          | Page                                                                        |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| Starfish            | yes                                | https://www.funretrospectives.com/starfish/                                 |
| 4Ls                 | yes                                | https://www.funretrospectives.com/the-4-ls-liked-learned-lacked-longed-for/ |
| Three Little Pigs   | yes                                | https://www.funretrospectives.com/three-little-pigs/                        |
| Hot Air Balloon     | yes (site name: "Hot-air Balloon") | https://www.funretrospectives.com/hot-air-balloon/                          |
| Speed Car           | yes                                | https://www.funretrospectives.com/speed-car/                                |
| Start-Stop-Continue | **not found**                      | the site has related activities such as KALM and DAKI                       |
| Mad-Sad-Glad        | **not found**                      | related: "Timeline driven by feelings", "Happiness radar"                   |
| Sailboat            | **not found**                      | related: "Anchors and Engine"                                               |
| Plus/Delta          | **not found**                      | related: "Well, Not so well, New ideas"                                     |
| Rose-Thorn-Bud      | **not found**                      |                                                                             |
| Timeline            | **not found under this name**      | related: "The Peaks and Valleys Timeline", "Timeline driven by feelings"    |
| Kudos Cards         | **not found**                      |                                                                             |

"Not found" means the searches did not return a page. The site has many activities and a search can miss one, so
the seven formats above need a direct look at the site's "Find an Activity" page.

## What this means (decision taken: keep the seven formats, neutral credit)

- The `source` field of the five confirmed formats links to their real page; their details page shows
  "Based on <name> on funretrospectives.com".
- The other seven formats (Start-Stop-Continue, Mad-Sad-Glad, Sailboat, Plus/Delta, Rose-Thorn-Bud, Timeline, Kudos Cards)
  are well-known retrospective formats. They have **no** `source` and their details page says "A widely used
  retrospective format."
- The app footer says "Some of the retrospective formats are based on activities from funretrospectives.com."
- If a page for one of the seven is found on the site later, add a `source` to its data file; no code change is needed.
- The licence or terms of use of the site have **not** been checked. The tool uses its own wording for descriptions,
  prompts and tips.

## Usability check (partly done)

The 5-minute goal for a first-time facilitator (AC-17, NFR-4) needs one real person without coaching background to
run the questionnaire and choose a format while somebody times it. Record the results here:

| Date       | Person                                                           | Time from start to chosen format    | Texts found unclear |
| ---------- | ---------------------------------------------------------------- | ----------------------------------- | ------------------- |
| 2026-10-14 | Project owner (Agile Coach, so **not** a first-time facilitator) | about 2 minutes (the questionnaire) | not recorded        |

The 2 minutes are well inside the 5-minute goal, but the person who tried it knows retrospectives well. AC-17 and
NFR-4 stay open until one team member with no coaching background has done it too.
