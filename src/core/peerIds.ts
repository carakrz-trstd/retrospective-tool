// Broker IDs. The PeerJS broker allows letters, digits, hyphens and underscores, and it is
// shared with other users of the public broker, so every ID carries the app prefix "retro".

import { normalizeJoinCode } from './ids';

/** The host's address for participants: long, from the random session ID (unguessable). */
export function sessionPeerId(sessionId: string): string {
  return `retro-s-${sessionId}`;
}

/** Answers join-code lookups only: short, derived from the code. */
export function resolverPeerId(joinCode: string): string {
  return `retro-c-${normalizeJoinCode(joinCode)}`;
}
