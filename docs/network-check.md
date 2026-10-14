# Company-network check (manual)

Corporate firewalls may block WebRTC or the connection to the signaling broker. Run this check **before** relying on
the tool, from the office network (and once from home or VPN for comparison). It is a manual check, not part of the
build.

## What you need

- Two company laptops on the office network (host and participant), or one laptop and a phone on the company Wi-Fi.
- The deployed site (GitHub Pages URL), or `npm run build && npm run preview` served from a reachable address.

## Steps

1. Laptop A: open the site, **Create session** (any name and role). Note the join link and the 6-character code.
2. Laptop B: open the join link, join with a name and role. Expected: B appears in A's lobby within a few seconds.
3. Laptop B: join a second time using only the **code** on the start page (use a third device or a private window).
   Expected: the join works.
4. Laptop A: press **Start session**. Expected: both laptops move to the session screen.
5. Laptop B: reload the page. Expected: B returns as the same person (no duplicate in A's list).
6. Laptop A: close the tab, wait until B shows "The Facilitator is offline", reopen the site and choose
   **Resume session**. Expected: B reconnects by itself.

## Record the result

| Date | Network | Join by link | Join by code | Reload and rejoin | Host resume | Notes |
| ---- | ------- | ------------ | ------------ | ----------------- | ----------- | ----- |
|      |         |              |              |                   |             |       |

## If something fails

- **Nothing connects at all:** the firewall probably blocks WebSocket connections to the broker or WebRTC. Ask IT to
  allow connections to the PeerJS public broker (`0.peerjs.com`, port 443) and to a public STUN server, or to
  provide a TURN relay. A TURN relay passes all session traffic (encrypted) through a server, so it needs a more
  careful approval.
- **Joining works but only on the same network segment:** direct connections are blocked; a TURN relay is needed.
- Both servers can be changed by configuration only (see the README), so a company-run broker or relay can be used
  without code changes.

## Question for IT (if the check works)

"May company laptops connect to the PeerJS public broker and a public STUN server? Only IP addresses and
connection details are exchanged, no session content (names, roles, entries, notes)."

## Optional smoke test against the real public broker

`e2e/manual/real-broker.spec.ts` runs the create-and-join flow once against the real public broker. It is excluded
from the normal e2e run. Start it with:

```
npx playwright test --config e2e/manual/playwright.manual.config.ts
```
