import { afterEach, describe, expect, it } from 'vitest';
import { getContrib } from '../../src/contrib/types';
import type { HostController } from '../../src/host/HostController';
import { getIntentHandler, isAnonymousIntent, registerIntentHandler } from '../../src/core/registry';
import { RawClient, flush } from '../hostHelpers';
import { cleanup, contribSetup } from './contribSetup';

const hosts: HostController[] = [];
afterEach(() => cleanup(hosts.splice(0)));

describe('the survey is anonymous on the host (AC-12)', () => {
  it('the host record and the applied-ops log contain neither the sender ID nor the token next to the answer', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    const alex = s.clients.Alex!;
    const answer = { retroRating: 4, retroComment: 'solid', toolRating: 5 };
    await alex.intent('survey.submit', { answerKey: 'device-key-1', answer }, 'survey-op-1');

    const survey = getContrib(s.host.data.state).survey;
    expect(Object.keys(survey.answers)).toEqual(['device-key-1']);
    expect(JSON.stringify(survey)).not.toContain(alex.participantId!);
    expect(JSON.stringify(survey)).not.toContain(alex.token!);
    // the operation is not logged against the sender
    expect(JSON.stringify(s.host.data.appliedOps)).not.toContain('survey-op-1');
    // and the persisted record says the same
    const record = JSON.parse(s.local.getItem('retro.host.SESSION1')!).data;
    const savedSurvey = JSON.stringify(record.state.extensions.contrib.survey);
    expect(savedSurvey).toContain('device-key-1');
    expect(savedSurvey).not.toContain(alex.participantId!);
    expect(savedSurvey).not.toContain(alex.token!);
    expect(JSON.stringify(record.appliedOps)).not.toContain('survey-op-1');
  });

  it('re-sending the same submit is harmless', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    const alex = s.clients.Alex!;
    const payload = { answerKey: 'k', answer: { retroRating: 3, toolRating: 3 } };
    await alex.intent('survey.submit', payload, 'o1');
    await alex.intent('survey.submit', payload, 'o1');
    await alex.intent('survey.submit', payload, 'o2');
    expect(Object.keys(getContrib(s.host.data.state).survey.answers)).toEqual(['k']);
  });

  it('a join that is not bound to a participant cannot submit', async () => {
    const s = await contribSetup();
    hosts.push(s.host);
    const stranger = await new RawClient(s.net).connect('SESSION1');
    await stranger.intent(
      'survey.submit',
      { answerKey: 'k', answer: { retroRating: 3, toolRating: 3 } },
      'o1',
    );
    await flush();
    expect(Object.keys(getContrib(s.host.data.state).survey.answers)).toEqual([]);
  });
});

describe('anonymous intents (Epic 1 addition used by the survey)', () => {
  it('an intent registered as anonymous gets no participant ID and leaves no trace in appliedOps', async () => {
    const s = await contribSetup({ clients: ['Alex'] });
    hosts.push(s.host);
    let seenSender: string | null | undefined;
    registerIntentHandler(
      'demo.anon',
      ({ state, senderId }) => {
        seenSender = senderId;
        return { ok: true, state };
      },
      { anonymous: true },
    );
    expect(isAnonymousIntent('demo.anon')).toBe(true);
    expect(isAnonymousIntent('entry.add')).toBe(false);
    expect(getIntentHandler('demo.anon')).toBeTruthy();
    await s.clients.Alex!.intent('demo.anon', {}, 'anon-op');
    expect(seenSender).toBeNull();
    expect(JSON.stringify(s.host.data.appliedOps)).not.toContain('anon-op');
  });
});
