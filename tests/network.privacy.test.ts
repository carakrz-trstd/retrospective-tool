import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRegistries } from '../src/core/registry';
import { MemoryNetwork } from '../src/transport/MemoryTransport';
import { joinClient, settle, startHost } from './sessionHelpers';

afterEach(() => {
  vi.unstubAllGlobals();
  resetRegistries();
});

describe('privacy: no session content leaves the browsers (AC-17)', () => {
  it('a complete session over the in-memory transport makes no network calls', async () => {
    const fetchSpy = vi.fn();
    const xhrOpen = vi.fn();
    const beacon = vi.fn();
    const wsSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        open = xhrOpen;
        send() {}
      },
    );
    vi.stubGlobal('WebSocket', wsSpy);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    const net = new MemoryNetwork();
    const { host } = await startHost(net);
    const a = joinClient(net, 'K7M4QX', 'Alex'); // by code: resolver lookup included
    const b = joinClient(net, 'SESSION1', 'Blake');
    await a.client.ready;
    await b.client.ready;
    host.startSession();
    a.client.leave();
    host.removeParticipant(b.client.snapshot.participantId!);
    host.endSession();
    await settle();
    host.stop();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(wsSpy).not.toHaveBeenCalled();
  });
});
