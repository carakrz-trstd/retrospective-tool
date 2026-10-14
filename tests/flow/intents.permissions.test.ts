import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, flowSetup } from './flowHelpers';
import type { HostController } from '../../src/host/HostController';

const hosts: HostController[] = [];
afterEach(() => {
  cleanup(hosts.splice(0));
});

describe('flow intents: permissions (AC-3)', () => {
  it('a participant sending any flow intent changes nothing', async () => {
    const s = await flowSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    const before = JSON.stringify(s.state());
    const alex = s.clients.Alex!;
    let n = 0;
    for (const [kind, payload] of [
      ['flow.next', {}],
      ['flow.prev', {}],
      ['flow.goto', { stop: 'notes' }],
      ['flow.timer', { action: 'start' }],
      ['flow.reveal', { key: 'checkIn' }],
      ['flow.muteAll', { muted: true }],
    ] as const) {
      await alex.intent(kind, payload, `a-${++n}`);
    }
    expect(JSON.stringify(s.state())).toBe(before);
    expect(s.flow().stop).toBe('checkIn');
  });

  it("the Facilitator's intents are applied", async () => {
    const s = await flowSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    expect(s.intent('flow.next').ok).toBe(true);
    expect(s.flow().stop).toBe('reviewActions');
    // and reach the participant
    await new Promise((r) => setTimeout(r, 0));
    const seen = s.clients.Alex!.state!.extensions.flow as { stop: string };
    expect(seen.stop).toBe('reviewActions');
  });

  it('flow intents are rejected in the lobby and after the session has ended', async () => {
    const s = await flowSetup({ start: false });
    hosts.push(s.host);
    expect(s.intent('flow.next').ok).toBe(false);
    expect(s.flow().stop).toBe('checkIn');
    s.host.startSession();
    expect(s.intent('flow.next').ok).toBe(true);
    s.host.endSession();
    expect(s.intent('flow.next').ok).toBe(false);
    expect(s.intent('flow.muteAll', { muted: true }).ok).toBe(false);
    expect(s.flow().stop).toBe('reviewActions');
  });

  it('unknown stops and malformed payloads are rejected', async () => {
    const s = await flowSetup();
    hosts.push(s.host);
    expect(s.intent('flow.goto', { stop: 'nowhere' }).ok).toBe(false);
    expect(s.intent('flow.timer', { action: 'explode' }).ok).toBe(false);
    expect(s.intent('flow.reveal', { key: 'other' }).ok).toBe(false);
    expect(s.intent('flow.muteAll', { muted: 'yes' }).ok).toBe(false);
    expect(s.flow().stop).toBe('checkIn');
  });
});
