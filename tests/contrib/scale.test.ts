import { afterEach, describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../../src/core/protocol';
import { getContribView } from '../../src/contrib/types';
import type { HostController } from '../../src/host/HostController';
import { RawClient, flush } from '../hostHelpers';
import { cleanup, contribSetup } from './contribSetup';

const hosts: HostController[] = [];
afterEach(() => cleanup(hosts.splice(0)));

describe('8 participants with many entries (AC-19)', () => {
  it('all clients converge after the reveal, with one update per recipient for the reveal', async () => {
    const names = Array.from({ length: 7 }, (_, i) => `P${i + 1}`); // plus the Facilitator = 8 people
    const s = await contribSetup({ clients: names });
    hosts.push(s.host);
    const clients = names.map((n) => s.clients[n]!);

    for (const [ci, c] of clients.entries()) {
      for (let i = 0; i < 40; i++) {
        c.conn.send({
          v: PROTOCOL_VERSION,
          type: 'intent',
          opId: `op-${ci}-${i}`,
          kind: 'entry.add',
          payload: {
            id: `e-${ci}-${i}`,
            kind: 'retro',
            columnId: 'abc'[i % 3] === 'a' ? 'a' : 'b',
            text: `entry ${ci}/${i}`,
          },
        });
      }
    }
    await flush(20);
    for (const c of clients) expect(Object.keys(getContribView(c.state!).entries)).toHaveLength(40);

    s.intent('flow.goto', { stop: 'retro.write' });
    await flush(10);
    const before = clients.map((c) => c.ofType('update').length);
    s.intent('flow.reveal', { key: 'retro' });
    await flush(10);
    clients.forEach((c, i) => expect(c.ofType('update').length - before[i]!).toBe(1));

    const ids = (c: RawClient) => Object.keys(getContribView(c.state!).entries).sort();
    const first = ids(clients[0]!);
    expect(first).toHaveLength(7 * 40);
    for (const c of clients) expect(ids(c)).toEqual(first);
    expect(Object.keys(getContribView(s.host.view()).entries).sort()).toEqual(first);
  });
});
