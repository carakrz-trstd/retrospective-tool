import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerContrib } from '../../src/contrib/register';
import { getContrib } from '../../src/contrib/types';
import { resetRegistries } from '../../src/core/registry';
import { resetFlowRegistries } from '../../src/flow/registries';
import { MemoryNetwork, MemoryTransport } from '../../src/transport/MemoryTransport';
import type { Transport } from '../../src/transport/Transport';
import { joinClient, makeDevice, rejoinClient, settle, startHost } from '../sessionHelpers';

let net: MemoryNetwork;
const stoppers: (() => void)[] = [];
const track = <T extends { stop(): void }>(x: T): T => {
  stoppers.push(() => x.stop());
  return x;
};

beforeEach(() => {
  net = new MemoryNetwork();
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
});
afterEach(() => {
  for (const s of stoppers.splice(0)) s();
  resetRegistries();
  resetFlowRegistries();
});

const answer = (retroRating: 1 | 2 | 3 | 4 | 5) => ({ retroRating, toolRating: 4 as const });

describe('the answer key of a device (AD-11)', () => {
  it('is created once per session, stored in the participant record, reused for changes, and never sent with the token', async () => {
    const { host } = await startHost(net);
    track(host);
    host.startSession();
    const device = makeDevice(net);
    const sent: unknown[] = [];
    const real = device.transport;
    const spy: Transport = {
      listen: (id, cb) => real.listen(id, cb),
      connect: async (id) => {
        const conn = await real.connect(id);
        return {
          get remoteId() {
            return conn.remoteId;
          },
          send: (m: unknown) => {
            sent.push(structuredClone(m));
            conn.send(m);
          },
          close: () => conn.close(),
          onMessage: (cb) => conn.onMessage(cb),
          onClose: (cb) => conn.onClose(cb),
        };
      },
      stop: () => real.stop(),
      onStatus: (cb) => real.onStatus(cb),
    };
    device.transport = spy as MemoryTransport;
    const { client } = joinClient(net, 'SESSION1', 'Alex', 'Dev', {}, device);
    track(client);
    await client.ready;
    await settle();

    expect(client.snapshot.surveyLocal).toBeNull();
    client.submitSurvey(answer(2));
    const key = client.snapshot.surveyLocal!.answerKey;
    expect(key).toMatch(/^[A-Za-z0-9-]{16,}$/);
    client.submitSurvey(answer(5));
    expect(client.snapshot.surveyLocal).toMatchObject({ answerKey: key, answer: { retroRating: 5 } });
    expect(device.store.loadParticipantRecord('SESSION1')!.survey).toMatchObject({ answerKey: key });
    await settle();

    // the host holds one answer under that key (the change replaced the first one)
    const answers = getContrib(host.data.state).survey.answers;
    expect(Object.keys(answers)).toEqual([key]);
    expect(answers[key]!.retroRating).toBe(5);

    // no single message carries both the answer key and the token
    const token = device.store.loadParticipantRecord('SESSION1')!.token;
    for (const m of sent) {
      const text = JSON.stringify(m);
      expect(text.includes(key) && text.includes(token)).toBe(false);
    }
    expect(sent.some((m) => JSON.stringify(m).includes(key))).toBe(true);
  });

  it('survives a reload: the same key and the own answer come back from the record', async () => {
    const { host } = await startHost(net);
    track(host);
    host.startSession();
    const first = joinClient(net, 'SESSION1', 'Alex');
    track(first.client);
    await first.client.ready;
    first.client.submitSurvey(answer(3));
    const key = first.client.snapshot.surveyLocal!.answerKey;
    first.client.stop();
    const again = track(rejoinClient(first.device, 'SESSION1'));
    expect(again.snapshot.surveyLocal).toMatchObject({ answerKey: key, answer: { retroRating: 3 } });
    again.submitSurvey(answer(4));
    expect(again.snapshot.surveyLocal!.answerKey).toBe(key);
  });

  it('two devices get different keys', async () => {
    const { host } = await startHost(net);
    track(host);
    host.startSession();
    const a = joinClient(net, 'SESSION1', 'Alex');
    const b = joinClient(net, 'SESSION1', 'Blake');
    track(a.client);
    track(b.client);
    await a.client.ready;
    await b.client.ready;
    a.client.submitSurvey(answer(1));
    b.client.submitSurvey(answer(1));
    expect(a.client.snapshot.surveyLocal!.answerKey).not.toBe(b.client.snapshot.surveyLocal!.answerKey);
  });
});
