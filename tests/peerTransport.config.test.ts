import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';

// A fake Peer that records how it was created and opens (or fails) like the real one.
const created: { id: string | undefined; options: Record<string, unknown> }[] = [];

vi.mock('peerjs', () => {
  class FakePeer {
    private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
    destroyed = false;
    open = false;
    disconnected = false;
    constructor(idOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) {
      if (typeof idOrOptions === 'string') created.push({ id: idOrOptions, options: options ?? {} });
      else created.push({ id: undefined, options: idOrOptions ?? {} });
      queueMicrotask(() => {
        this.open = true;
        this.emit('open', 'id');
      });
    }
    on(event: string, cb: (...args: unknown[]) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]);
      return this;
    }
    off() {
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const cb of this.handlers.get(event) ?? []) cb(...args);
    }
    destroy() {
      this.destroyed = true;
    }
    reconnect() {}
    connect() {
      return { on() {}, close() {}, peer: 'x' };
    }
  }
  return { Peer: FakePeer };
});

import { PeerTransport } from '../src/transport/PeerTransport';

beforeEach(() => {
  created.length = 0;
});

describe('PeerTransport configuration', () => {
  it('passes broker host/port/path/key/secure and the STUN list from the config to the Peer', async () => {
    const cfg = loadConfig({
      VITE_PEER_HOST: 'broker.example',
      VITE_PEER_PORT: '9443',
      VITE_PEER_PATH: '/signal',
      VITE_PEER_KEY: 'abc',
      VITE_PEER_SECURE: 'true',
      VITE_STUN_URLS: 'stun:a.example:3478,stun:b.example:3478',
    });
    const t = new PeerTransport(cfg);
    await t.listen('retro-s-1', () => {});
    expect(created).toHaveLength(1);
    expect(created[0]!.id).toBe('retro-s-1');
    expect(created[0]!.options).toMatchObject({
      host: 'broker.example',
      port: 9443,
      path: '/signal',
      key: 'abc',
      secure: true,
      config: { iceServers: [{ urls: 'stun:a.example:3478' }, { urls: 'stun:b.example:3478' }] },
    });
  });

  it('changing the config changes the arguments with no other code change', async () => {
    await new PeerTransport(loadConfig({ VITE_PEER_HOST: 'one.example' })).listen('a', () => {});
    await new PeerTransport(loadConfig({ VITE_PEER_HOST: 'two.example', VITE_STUN_URLS: '' })).listen(
      'b',
      () => {},
    );
    expect(created[0]!.options.host).toBe('one.example');
    expect(created[1]!.options.host).toBe('two.example');
    expect((created[1]!.options.config as { iceServers: unknown[] }).iceServers).toEqual([]);
  });

  it('listening on two IDs creates two peers', async () => {
    const t = new PeerTransport(loadConfig({}));
    await t.listen('retro-s-1', () => {});
    await t.listen('retro-c-K7M4QX', () => {});
    expect(created.map((c) => c.id)).toEqual(['retro-s-1', 'retro-c-K7M4QX']);
  });
});

describe('PeerJS isolation', () => {
  it('no module other than PeerTransport imports peerjs', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !path.endsWith(join('transport', 'PeerTransport.ts'))) {
          if (/from\s+['"]peerjs['"]|import\(['"]peerjs['"]\)/.test(readFileSync(path, 'utf8')))
            offenders.push(path);
        }
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(offenders).toEqual([]);
  });
});
