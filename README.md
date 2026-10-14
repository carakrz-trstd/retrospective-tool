# Retrospective Tool

An internal tool that lets any team member run a retrospective when the Agile Coach is away. A static web
app (TypeScript, Vite, Preact) for GitHub Pages. Everybody uses their own device; the Facilitator's browser hosts
the live session, and nothing is stored on a server.

This repository currently contains **Epic 1: session lifecycle and live collaboration** (create a session,
join by link or code, lobby, start, rejoin, resume, remove, end). Formats, the guided flow, contributions and
the documentation export follow in the next epics (see `specs/`).

## Scripts

| Command            | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| `npm run dev`      | Development server                                                         |
| `npm run build`    | Type check and production build into `dist/`                               |
| `npm run preview`  | Serve the production build                                                 |
| `npm test`         | Unit and component tests (Vitest)                                          |
| `npm run lint`     | Type check and formatting check                                            |
| `npm run format`   | Format all files with Prettier                                             |
| `npm run test:e2e` | Playwright end-to-end tests (needs `npx playwright install chromium` once) |

The e2e tests build the app with `.env.e2e` (local signaling server on port 9000, no STUN servers) and need no
internet connection.

## Configuration: broker and STUN servers

Live connections use PeerJS (WebRTC). Two servers are involved and both are replaceable settings in `src/config.ts`,
read from Vite environment values at build time:

| Variable           | Default                        | Meaning                                     |
| ------------------ | ------------------------------ | ------------------------------------------- |
| `VITE_PEER_HOST`   | `0.peerjs.com`                 | Signaling broker host                       |
| `VITE_PEER_PORT`   | `443`                          | Broker port                                 |
| `VITE_PEER_PATH`   | `/`                            | Broker path                                 |
| `VITE_PEER_KEY`    | `peerjs`                       | Broker key                                  |
| `VITE_PEER_SECURE` | `true`                         | Use TLS to the broker                       |
| `VITE_STUN_URLS`   | `stun:stun.l.google.com:19302` | Comma-separated STUN servers (empty = none) |

The broker and the STUN servers see connection details (such as IP addresses) but never session content. Before
a wider rollout, run the company-network check in [docs/network-check.md](docs/network-check.md).

## Deployment (GitHub Pages)

1. In the repository settings, set **Pages > Source** to **GitHub Actions**.
2. Push to `main`. The workflow `.github/workflows/deploy.yml` runs lint, tests and the build, and deploys `dist/`.
3. The site works from the Pages sub-path because the build uses relative asset paths and the join link uses the
   URL fragment (`#/join/<id>`).

## Privacy

- No accounts, no analytics, no server-side storage of session data.
- A session lives in the participants' browsers. The Facilitator's device keeps a local copy (localStorage) so a
  closed browser can resume; records not written for 24 hours are removed automatically.
