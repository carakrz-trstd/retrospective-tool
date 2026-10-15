import { afterEach, describe, expect, it } from 'vitest';
import { registerContrib } from '../../src/contrib/register';
import { registerDocEnd, parseFinalPayload } from '../../src/doc/endIntegration';
import { isDocumentModel } from '../../src/doc/model';
import { PROTOCOL_VERSION } from '../../src/core/protocol';
import type { HostController } from '../../src/host/HostController';
import { RawClient, flush } from '../hostHelpers';
import { cleanup, contribSetup } from '../contrib/contribSetup';

const hosts: HostController[] = [];
afterEach(() => cleanup(hosts.splice(0)));

async function runningSession() {
  const s = await contribSetup({ clients: ['Alex', 'Blake'] });
  registerDocEnd();
  registerContrib();
  hosts.push(s.host);
  return s;
}

const finalOf = (c: RawClient) => parseFinalPayload(c.ofType('ended')[0]?.payload);

describe('the final documentation at the end of the session (AC-16, AC-19)', () => {
  it('every connected participant receives `ended` with the same model, without unrevealed entries', async () => {
    const s = await runningSession();
    const [alex, blake] = [s.clients.Alex!, s.clients.Blake!];
    await alex.intent('entry.add', { id: 'r1', kind: 'retro', columnId: 'a', text: 'revealed one' }, 'a1');
    s.intent('flow.goto', { stop: 'retro.write' });
    s.intent('flow.reveal', { key: 'retro' });
    await blake.intent('entry.add', { id: 'c1', kind: 'checkIn', text: 'never revealed' }, 'b1');
    s.host.endSession();
    await flush();

    const a = finalOf(alex);
    const b = finalOf(blake);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(isDocumentModel(a)).toBe(true);
    expect(JSON.stringify(a)).toContain('revealed one');
    expect(JSON.stringify(a)).not.toContain('never revealed');
    expect(a!.incomplete).toBe(false);
  });

  it('a participant who was offline at the end gets `ended` and the model when they rejoin with their token', async () => {
    const s = await runningSession();
    const alex = s.clients.Alex!;
    const token = alex.token!;
    alex.close();
    await flush();
    s.host.endSession();
    await flush();
    const back = await new RawClient(s.net).connect('SESSION1');
    await back.rejoin(token);
    expect(finalOf(back)).not.toBeNull();
    expect(back.ofType('welcome')).toHaveLength(1);
  });

  it('a new participant cannot join an ended session, and a removed participant cannot rejoin', async () => {
    const s = await runningSession();
    const blake = s.clients.Blake!;
    const token = blake.token!;
    s.host.removeParticipant(blake.participantId!);
    await flush();
    s.host.endSession();
    await flush();

    const stranger = await new RawClient(s.net).connect('SESSION1');
    await stranger.join('Newcomer');
    expect(stranger.ofType('welcome')).toHaveLength(0);
    expect(stranger.ofType('rejected').map((r) => r.reason)).toEqual(['session-ended']);

    const removed = await new RawClient(s.net).connect('SESSION1');
    removed.send({ type: 'rejoin', token });
    await flush();
    expect(removed.ofType('welcome')).toHaveLength(0);
    expect(removed.ofType('ended')).toHaveLength(0);
  });

  it('the payload never contains participant IDs or tokens', async () => {
    const s = await runningSession();
    s.host.endSession();
    await flush();
    const json = JSON.stringify(s.clients.Alex!.ofType('ended')[0]);
    for (const c of Object.values(s.clients)) {
      expect(json).not.toContain(c.participantId!);
      expect(json).not.toContain(c.token!);
    }
    void PROTOCOL_VERSION;
  });

  it('parseFinalPayload accepts only a valid model', () => {
    expect(parseFinalPayload(undefined)).toBeNull();
    expect(parseFinalPayload({ final: { version: 99 } })).toBeNull();
    expect(parseFinalPayload('x')).toBeNull();
  });
});
