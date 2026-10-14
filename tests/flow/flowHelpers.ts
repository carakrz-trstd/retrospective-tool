import { HostController } from '../../src/host/HostController';
import { resetRegistries } from '../../src/core/registry';
import { getFlow } from '../../src/flow/flowState';
import { registerFlow } from '../../src/flow';
import { resetFlowRegistries } from '../../src/flow/registries';
import type { SessionState } from '../../src/core/types';
import { Store } from '../../src/storage/storage';
import { MemoryNetwork, MemoryTransport } from '../../src/transport/MemoryTransport';
import { testFormat } from '../helpers';
import { RawClient } from '../hostHelpers';
import { MemoryStorage } from '../storageFakes';

export const T0 = 1_000_000;

/** A running host with a controllable clock, the flow handlers registered, and helpers for clients. */
export async function flowSetup(opts: { start?: boolean; clients?: string[] } = {}) {
  resetRegistries();
  resetFlowRegistries();
  registerFlow();
  const net = new MemoryNetwork();
  const local = new MemoryStorage();
  const store = new Store({
    local,
    session: new MemoryStorage(),
    now: () => Date.now(),
    expiryMs: 86_400_000,
  });
  const clock = { now: T0 };
  const host = HostController.create(
    {
      name: 'Fiona',
      role: 'Scrum Master',
      format: testFormat,
      timeBudgetMin: 50,
      sessionId: 'SESSION1',
      joinCode: 'K7M4QX',
    },
    { transport: new MemoryTransport(net), store, now: () => clock.now },
  );
  await host.ready;
  const clients: Record<string, RawClient> = {};
  for (const name of opts.clients ?? []) {
    clients[name] = await new RawClient(net).connect('SESSION1');
    await clients[name]!.join(name);
  }
  if (opts.start !== false) host.startSession();
  let n = 0;
  const intent = (kind: string, payload: unknown = {}) => host.applyLocalIntent(kind, payload, `op-${++n}`);
  const flow = () => getFlow(host.data.state);
  return {
    host,
    net,
    store,
    local,
    clock,
    clients,
    intent,
    flow,
    state: (): SessionState => host.data.state,
  };
}

export function cleanup(hosts: HostController[]): void {
  for (const h of hosts) h.stop();
  resetRegistries();
  resetFlowRegistries();
}
