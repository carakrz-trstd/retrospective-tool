// The only file that imports PeerJS. Implements Transport on top of PeerJS (WebRTC data
// connections) and its signaling broker. Broker and STUN servers come from config.ts.
// The signaling broker only sees connection metadata, never session content.

import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { config as defaultConfig, type AppConfig } from '../config';
import {
  IdTakenError,
  NotFoundError,
  type Connection,
  type Transport,
  type TransportStatus,
} from './Transport';

const CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

export function peerOptions(cfg: AppConfig): PeerOptions {
  return {
    host: cfg.broker.host,
    port: cfg.broker.port,
    path: cfg.broker.path,
    key: cfg.broker.key,
    secure: cfg.broker.secure,
    debug: 0,
    config: { iceServers: cfg.stunUrls.map((urls) => ({ urls })) },
  };
}

class PeerConnection implements Connection {
  readonly remoteId: string;
  private messageCbs: ((msg: unknown) => void)[] = [];
  private closeCbs: (() => void)[] = [];
  private closed = false;

  constructor(private readonly dc: DataConnection) {
    this.remoteId = dc.peer;
    dc.on('data', (data) => {
      for (const cb of this.messageCbs) cb(data);
    });
    const onClose = () => {
      if (this.closed) return;
      this.closed = true;
      for (const cb of this.closeCbs) cb();
    };
    dc.on('close', onClose);
    dc.on('error', onClose);
  }

  send(msg: unknown): void {
    if (this.closed) return;
    try {
      this.dc.send(msg);
    } catch {
      /* the connection is going away; onClose will follow */
    }
  }

  close(): void {
    try {
      this.dc.close();
    } catch {
      /* already closed */
    }
  }

  onMessage(cb: (msg: unknown) => void): void {
    this.messageCbs.push(cb);
  }

  onClose(cb: () => void): void {
    this.closeCbs.push(cb);
  }
}

export class PeerTransport implements Transport {
  private statusCbs: ((s: TransportStatus) => void)[] = [];
  private status: TransportStatus = 'connecting';
  private hostPeers: Peer[] = [];
  private clientPeer: Peer | null = null;
  private clientPeerReady: Promise<Peer> | null = null;
  private stopped = false;

  constructor(private readonly cfg: AppConfig = defaultConfig) {}

  onStatus(cb: (s: TransportStatus) => void): void {
    this.statusCbs.push(cb);
    cb(this.status);
  }

  private setStatus(s: TransportStatus): void {
    if (s === this.status) return;
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }

  /** Reconnects to the broker after it was lost; existing data connections are not affected. */
  private keepSignaling(peer: Peer): void {
    peer.on('disconnected', () => {
      if (this.stopped || peer.destroyed) return;
      this.setStatus('offline');
      const retry = () => {
        if (this.stopped || peer.destroyed) return;
        try {
          peer.reconnect();
        } catch {
          setTimeout(retry, RECONNECT_DELAY_MS);
        }
      };
      setTimeout(retry, RECONNECT_DELAY_MS);
    });
    peer.on('open', () => {
      if (!this.stopped) this.setStatus('online');
    });
  }

  listen(id: string, onConnection: (c: Connection) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(id, peerOptions(this.cfg));
      this.hostPeers.push(peer);
      let opened = false;
      peer.on('open', () => {
        opened = true;
        resolve();
      });
      peer.on('error', (err) => {
        const type = (err as { type?: string }).type;
        if (!opened) {
          this.hostPeers = this.hostPeers.filter((p) => p !== peer);
          peer.destroy();
          reject(type === 'unavailable-id' ? new IdTakenError(id) : err);
        }
      });
      peer.on('connection', (dc) => {
        const connection = new PeerConnection(dc);
        if (dc.open) onConnection(connection);
        else dc.on('open', () => onConnection(connection));
      });
      this.keepSignaling(peer);
    });
  }

  private ensureClientPeer(): Promise<Peer> {
    if (this.clientPeerReady) return this.clientPeerReady;
    this.clientPeerReady = new Promise<Peer>((resolve, reject) => {
      const peer = new Peer(peerOptions(this.cfg));
      this.clientPeer = peer;
      const timer = setTimeout(
        () => reject(new Error('Could not reach the connection service')),
        CONNECT_TIMEOUT_MS,
      );
      peer.on('open', () => {
        clearTimeout(timer);
        resolve(peer);
      });
      peer.on('error', (err) => {
        const type = (err as { type?: string }).type;
        if (!peer.open && type !== 'peer-unavailable') {
          clearTimeout(timer);
          reject(err);
        }
      });
      this.keepSignaling(peer);
    }).catch((err) => {
      this.clientPeerReady = null;
      this.clientPeer = null;
      throw err;
    });
    return this.clientPeerReady;
  }

  async connect(id: string): Promise<Connection> {
    const peer = await this.ensureClientPeer();
    if (peer.disconnected && !peer.destroyed) {
      try {
        peer.reconnect();
      } catch {
        /* the connect below fails if it did not work */
      }
    }
    return new Promise<Connection>((resolve, reject) => {
      const dc = peer.connect(id, { serialization: 'json', reliable: true });
      const timer = setTimeout(() => {
        cleanup();
        dc.close();
        reject(new Error(`Could not connect to ${id}`));
      }, CONNECT_TIMEOUT_MS);
      const onPeerError = (err: unknown) => {
        const e = err as { type?: string; message?: string };
        if (e.type === 'peer-unavailable' && (e.message ?? '').includes(id)) {
          cleanup();
          reject(new NotFoundError(id));
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        peer.off('error', onPeerError);
      };
      peer.on('error', onPeerError);
      dc.on('open', () => {
        cleanup();
        resolve(new PeerConnection(dc));
      });
      dc.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });
  }

  stop(): void {
    this.stopped = true;
    for (const peer of this.hostPeers) peer.destroy();
    this.hostPeers = [];
    this.clientPeer?.destroy();
    this.clientPeer = null;
    this.clientPeerReady = null;
    this.setStatus('offline');
  }
}
