// A local PeerJS signaling server for the e2e tests: deterministic, offline, no public broker.
// Started by Playwright's webServer (see playwright.config.ts) on port 9000.
import { PeerServer } from 'peer';

const port = Number(process.env.PEER_PORT ?? 9000);
PeerServer({ port, path: '/', key: 'peerjs', allow_discovery: false });
console.log(`Local PeerJS signaling server listening on port ${port}`);
