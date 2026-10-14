import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import type { Connection } from '../src/transport/Transport';

afterEach(() => vi.useRealTimers());

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('MemoryTransport', () => {
  it('a host listen and a client connect exchange messages in order', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    const hostSeen: unknown[] = [];
    let hostConn!: Connection;
    await host.listen('host-1', (c) => {
      hostConn = c;
      c.onMessage((m) => hostSeen.push(m));
    });
    const conn = await client.connect('host-1');
    const clientSeen: unknown[] = [];
    conn.onMessage((m) => clientSeen.push(m));
    conn.send({ n: 1 });
    conn.send({ n: 2 });
    conn.send({ n: 3 });
    await flush();
    expect(hostSeen).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    hostConn.send('hello');
    hostConn.send('again');
    await flush();
    expect(clientSeen).toEqual(['hello', 'again']);
  });

  it('copies messages like a real wire (no shared references)', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    let received: { a: number[] } | null = null;
    await host.listen('h', (c) => c.onMessage((m) => (received = m as { a: number[] })));
    const conn = await client.connect('h');
    const msg = { a: [1] };
    conn.send(msg);
    msg.a.push(2);
    await flush();
    expect(received).toEqual({ a: [1] });
  });

  it('the host can listen on two IDs', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    const seen: string[] = [];
    await host.listen('session-id', () => seen.push('session'));
    await host.listen('resolver-id', () => seen.push('resolver'));
    await client.connect('session-id');
    await client.connect('resolver-id');
    await flush();
    expect(seen).toEqual(['session', 'resolver']);
  });

  it('drop closes both sides, and a new connect works afterwards', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    const hostClosed = vi.fn();
    const seen: unknown[] = [];
    await host.listen('h', (c) => {
      c.onClose(hostClosed);
      c.onMessage((m) => seen.push(m));
    });
    const conn = await client.connect('h');
    const clientClosed = vi.fn();
    conn.onClose(clientClosed);
    await flush();
    net.dropAll();
    expect(clientClosed).toHaveBeenCalledTimes(1);
    expect(hostClosed).toHaveBeenCalledTimes(1);
    const again = await client.connect('h');
    await flush();
    again.send('ping');
    await flush();
    expect(seen).toEqual(['ping']);
  });

  it('sending on a closed connection does nothing', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    const seen: unknown[] = [];
    await host.listen('h', (c) => c.onMessage((m) => seen.push(m)));
    const conn = await client.connect('h');
    conn.close();
    conn.send('late');
    await flush();
    expect(seen).toEqual([]);
  });

  it('connecting to an unknown ID fails', async () => {
    const net = new MemoryNetwork();
    const client = new MemoryTransport(net);
    await expect(client.connect('nobody')).rejects.toThrow();
  });

  it('after the host stops, connecting fails and its connections are closed', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    await host.listen('h', () => {});
    const conn = await client.connect('h');
    const closed = vi.fn();
    conn.onClose(closed);
    host.stop();
    expect(closed).toHaveBeenCalled();
    await expect(client.connect('h')).rejects.toThrow();
  });

  it('delivery can be delayed by the test', async () => {
    vi.useFakeTimers();
    const net = new MemoryNetwork();
    net.setDelay(500);
    const host = new MemoryTransport(net);
    const client = new MemoryTransport(net);
    const seen: unknown[] = [];
    await host.listen('h', (c) => c.onMessage((m) => seen.push(m)));
    const conn = await client.connect('h');
    await vi.advanceTimersByTimeAsync(500); // the host sees the connection
    conn.send('slow');
    await vi.advanceTimersByTimeAsync(499);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual(['slow']);
  });

  it('reports online after listen', async () => {
    const net = new MemoryNetwork();
    const host = new MemoryTransport(net);
    const statuses: string[] = [];
    host.onStatus((s) => statuses.push(s));
    await host.listen('h', () => {});
    expect(statuses).toEqual(['connecting', 'online']);
    host.stop();
    expect(statuses.at(-1)).toBe('offline');
  });
});
