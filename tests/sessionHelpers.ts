import { vi } from 'vitest';
import { ClientController, type ClientOptions } from '../src/client/ClientController';
import { HostController, type HostCreateInput } from '../src/host/HostController';
import { Store } from '../src/storage/storage';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import { testFormat } from './helpers';
import { MemoryStorage } from './storageFakes';

/** A device: its own storage and transport, like a separate browser. */
export function makeDevice(net: MemoryNetwork) {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const store = new Store({ local, session, now: () => Date.now(), expiryMs: 86_400_000 });
  const transport = new MemoryTransport(net);
  return { local, session, store, transport, net };
}

export type Device = ReturnType<typeof makeDevice>;

export async function startHost(net: MemoryNetwork, over: Partial<HostCreateInput> = {}) {
  const device = makeDevice(net);
  const host = HostController.create(
    {
      name: 'Fiona',
      role: 'Scrum Master',
      format: testFormat,
      timeBudgetMin: 50,
      sessionId: 'SESSION1',
      joinCode: 'K7M4QX',
      ...over,
    },
    { transport: device.transport, store: device.store },
  );
  await host.ready;
  return { host, device };
}

export function joinClient(
  net: MemoryNetwork,
  target: string,
  name: string,
  role = 'Dev',
  opts: Partial<ClientOptions> = {},
  device: Device = makeDevice(net),
) {
  const client = ClientController.join(
    target,
    { name, role },
    {
      transport: device.transport,
      store: device.store,
      ...opts,
    },
  );
  return { client, device };
}

export function rejoinClient(device: Device, sessionId: string, opts: Partial<ClientOptions> = {}) {
  // a fresh transport on the same device, like reopening the page
  const transport = new MemoryTransport(device.net);
  device.transport = transport;
  return ClientController.rejoin(sessionId, { transport, store: device.store, ...opts });
}

export async function settle(ms = 0): Promise<void> {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms);
  else for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, ms));
}
