import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { questionnaire } from '../../src/formats/questionnaire';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => cleanup());

function openQuestionnaire() {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  return t;
}

function answerAll() {
  for (const name of [
    'Tired',
    'Reflect on the period since the last retro',
    '30 minutes',
    'Lean',
    'Remote',
  ]) {
    fireEvent.click(screen.getByRole('radio', { name }));
  }
}

describe('questionnaire screen', () => {
  it('shows the 5 questions with their options and helper texts', () => {
    openQuestionnaire();
    expect(screen.getAllByRole('group')).toHaveLength(5);
    for (const q of questionnaire) {
      const group = screen.getByRole('group', { name: q.label });
      expect(within(group).getByText(q.help)).toBeTruthy();
      for (const o of q.options) expect(within(group).getByRole('radio', { name: o.label })).toBeTruthy();
    }
  });

  it('"Show recommendation" is disabled until all are answered', () => {
    openQuestionnaire();
    const button = screen.getByRole('button', { name: 'Show recommendation' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Tired' }));
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('marks the unanswered questions after an attempt and does not show a suggestion', async () => {
    openQuestionnaire();
    fireEvent.click(screen.getByRole('radio', { name: 'Tired' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show recommendation' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(4); // the four unanswered questions
    expect(screen.queryByRole('heading', { name: 'Our suggestion' })).toBeNull();
  });

  it('answering all enables the button and one click shows the suggestion (5 selections and 1 click)', async () => {
    openQuestionnaire();
    answerAll();
    const button = screen.getByRole('button', { name: 'Show recommendation' });
    expect(button.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Our suggestion' });
  });

  it('contains the links "Browse all formats" and "Create custom format"', async () => {
    openQuestionnaire();
    expect(screen.getByRole('button', { name: 'Browse all formats' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create custom format' }));
    await screen.findByRole('heading', { name: 'Create a custom format' });
  });

  it('changing an answer after a suggestion starts a new suggestion', async () => {
    const t = openQuestionnaire();
    answerAll();
    fireEvent.click(screen.getByRole('button', { name: 'Show recommendation' }));
    await screen.findByRole('heading', { name: 'Our suggestion' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the questions' }));
    await screen.findByRole('group', { name: questionnaire[0]!.label });
    expect((screen.getByRole('radio', { name: 'Tired' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Energized' }));
    expect(t.app.flow.recommendation.value).toBeNull();
  });

  it('a link into the middle of the flow without answers starts at the questionnaire', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new/recommendation' });
    renderApp(t);
    await screen.findByRole('group', { name: questionnaire[0]!.label });
  });
});
