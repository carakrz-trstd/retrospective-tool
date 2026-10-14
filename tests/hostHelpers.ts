import { applyChanges } from '../src/core/diff';
import { PROTOCOL_VERSION, type ClientMessage, type HostMessage } from '../src/core/protocol';
import { sessionPeerId } from '../src/core/peerIds';
import type { SessionState } from '../src/core/types';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import type { Connection } from '../src/transport/Transport';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
}

/** A protocol-level test client: keeps a replica of the state it is allowed to see. */
export class RawClient {
  conn!: Connection;
  messages: HostMessage[] = [];
  state: SessionState | null = null;
  token: string | undefined;
  participantId: string | undefined;
  lastSeq = -1;
  gaps = 0;
  closed = false;
  private transport: MemoryTransport;

  constructor(private net: MemoryNetwork) {
    this.transport = new MemoryTransport(net);
  }

  async connect(sessionId: string): Promise<this> {
    this.conn = await this.transport.connect(sessionPeerId(sessionId));
    this.conn.onMessage((m) => this.receive(m as HostMessage));
    this.conn.onClose(() => (this.closed = true));
    return this;
  }

  private receive(msg: HostMessage): void {
    this.messages.push(msg);
    if (msg.type === 'welcome') {
      this.state = msg.state;
      this.lastSeq = msg.seq;
      this.participantId = msg.participantId;
      if (msg.token) this.token = msg.token;
    } else if (msg.type === 'update' && this.state) {
      if (msg.seq !== this.lastSeq + 1) this.gaps++;
      this.lastSeq = msg.seq;
      this.state = { ...applyChanges(this.state, msg.changes), rev: msg.rev };
    }
  }

  send(msg: DistributiveOmit<ClientMessage, 'v'> & { v?: number }): void {
    this.conn.send({ v: PROTOCOL_VERSION, ...msg });
  }

  async join(name: string, role = 'Dev'): Promise<this> {
    this.send({ type: 'join', name, role });
    await flush();
    return this;
  }

  async rejoin(token: string): Promise<this> {
    this.send({ type: 'rejoin', token });
    await flush();
    return this;
  }

  async intent(kind: string, payload: unknown, opId: string): Promise<void> {
    this.send({ type: 'intent', opId, kind, payload });
    await flush();
  }

  ofType<T extends HostMessage['type']>(type: T): Extract<HostMessage, { type: T }>[] {
    return this.messages.filter((m) => m.type === type) as Extract<HostMessage, { type: T }>[];
  }

  close(): void {
    this.conn.close();
  }
}
