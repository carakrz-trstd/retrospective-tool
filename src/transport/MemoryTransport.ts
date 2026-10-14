// In-memory transport for tests: transports that share one MemoryNetwork can listen and connect
// to each other. Connections can be dropped and delayed on purpose.

import {
  IdTakenError,
  NotFoundError,
  type Connection,
  type Transport,
  type TransportStatus,
} from './Transport';

let connectionCounter = 0;

class MemoryConnection implements Connection {
  readonly remoteId: string;
  peer: MemoryConnection | null = null;
  private messageCbs: ((msg: unknown) => void)[] = [];
  private closeCbs: (() => void)[] = [];
  closed = false;

  constructor(
    remoteId: string,
    private readonly network: MemoryNetwork,
  ) {
    this.remoteId = remoteId;
  }

  send(msg: unknown): void {
    if (this.closed || !this.peer) return;
    const copy = structuredClone(msg); // like a real wire: no shared references
    const target = this.peer;
    this.network.deliver(() => target.receive(copy));
  }

  private receive(msg: unknown): void {
    if (this.closed) return;
    for (const cb of this.messageCbs) cb(msg);
  }

  close(): void {
    if (this.closed) return;
    this.markClosed();
    const peer = this.peer;
    if (peer) this.network.deliver(() => peer.markClosed());
  }

  markClosed(): void {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.closeCbs) cb();
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageCbs.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeCbs.push(cb);
  }
}

export class MemoryNetwork {
  private listeners = new Map<string, { onConnection: (c: Connection) => void; owner: MemoryTransport }>();
  private connections = new Set<MemoryConnection>();
  private delayMs = 0;

  /** Delivers messages after `ms` milliseconds (0 = as soon as possible, still asynchronous). */
  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  deliver(fn: () => void): void {
    if (this.delayMs > 0) setTimeout(fn, this.delayMs);
    else queueMicrotask(fn);
  }

  register(id: string, owner: MemoryTransport, onConnection: (c: Connection) => void): void {
    if (this.listeners.has(id)) throw new IdTakenError(id);
    this.listeners.set(id, { onConnection, owner });
  }

  unregister(id: string): void {
    this.listeners.delete(id);
  }

  isListening(id: string): boolean {
    return this.listeners.has(id);
  }

  connect(id: string, from: MemoryTransport): Connection {
    const listener = this.listeners.get(id);
    if (!listener) throw new NotFoundError(id);
    const connId = `c${++connectionCounter}`;
    const clientSide = new MemoryConnection(id, this);
    const hostSide = new MemoryConnection(connId, this);
    clientSide.peer = hostSide;
    hostSide.peer = clientSide;
    this.connections.add(clientSide);
    this.connections.add(hostSide);
    from.track(clientSide);
    listener.owner.track(hostSide);
    // The host sees the connection a moment later, like a real connection.
    this.deliver(() => listener.onConnection(hostSide));
    return clientSide;
  }

  /** Closes every open connection, on both sides. */
  dropAll(): void {
    for (const c of Array.from(this.connections)) c.markClosed();
    this.connections.clear();
  }
}

export class MemoryTransport implements Transport {
  private statusCbs: ((s: TransportStatus) => void)[] = [];
  private status: TransportStatus = 'connecting';
  private ids: string[] = [];
  private conns = new Set<MemoryConnection>();

  constructor(private readonly network: MemoryNetwork) {}

  track(c: MemoryConnection): void {
    this.conns.add(c);
  }

  private setStatus(s: TransportStatus): void {
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }

  async listen(id: string, onConnection: (c: Connection) => void): Promise<void> {
    this.network.register(id, this, onConnection);
    this.ids.push(id);
    this.setStatus('online');
  }

  async connect(id: string): Promise<Connection> {
    if (!this.network.isListening(id)) throw new NotFoundError(id);
    const conn = this.network.connect(id, this);
    if (this.status !== 'online') this.setStatus('online');
    return conn;
  }

  /** Closes this transport's connections but keeps listening (like a network blip). */
  dropConnections(): void {
    for (const c of Array.from(this.conns)) {
      c.markClosed();
      if (c.peer) c.peer.markClosed();
    }
    this.conns.clear();
  }

  stop(): void {
    for (const id of this.ids) this.network.unregister(id);
    this.ids = [];
    this.dropConnections();
    this.setStatus('offline');
  }

  onStatus(cb: (s: TransportStatus) => void): void {
    this.statusCbs.push(cb);
    cb(this.status);
  }
}
