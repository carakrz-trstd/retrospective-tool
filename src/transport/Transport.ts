// The only thing the rest of the app knows about how devices talk to each other.
// PeerTransport (PeerJS) is the real implementation; MemoryTransport is used in tests.

export interface Connection {
  /** The ID of the other end (host side: the participant's connection ID). */
  readonly remoteId: string;
  send(msg: unknown): void;
  close(): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
}

export type TransportStatus = 'connecting' | 'online' | 'offline';

/** Thrown by listen() when the ID is already registered (another session, or a stale registration). */
export class IdTakenError extends Error {
  readonly code = 'id-taken';
  constructor(id: string) {
    super(`The ID ${id} is already taken on the broker`);
  }
}

/** Thrown by connect() when nobody listens on the ID (the host is offline or the code is wrong). */
export class NotFoundError extends Error {
  readonly code = 'not-found';
  constructor(id: string) {
    super(`Nobody listens on ${id}`);
  }
}

export function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'not-found';
}

export function isIdTaken(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'id-taken';
}

export interface Transport {
  /** Host: accept connections addressed to `id`. May be called for several IDs. */
  listen(id: string, onConnection: (c: Connection) => void): Promise<void>;
  /** Participant: connect to the host that listens on `id`. Rejects when nobody listens there. */
  connect(id: string): Promise<Connection>;
  /** Stops listening and closes all connections of this transport. */
  stop(): void;
  onStatus(cb: (status: TransportStatus) => void): void;
}
