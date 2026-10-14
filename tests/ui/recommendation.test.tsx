import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { scoringConfig } from '../../src/formats/defaults';
import { recommend } from '../../src/formats/scoring';
import type { Answers } from '../../src/formats/types';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';
import { sampleFormat } from '../formats/sample';

afterEach(() => cleanup());

const answers: Answers = {
  mood: 'tired',
  goal: 'reflect-period',
  timeBudgetMin: 30,
  depth: 'lean',
  setting: 'remote',
};

function showSuggestion(a: Answers = answers) {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  for (const [key, value] of Object.entries(a)) t.app.flow.setAnswer(key as keyof Answers, value as never);
  t.app.flow.showRecommendation();
  return t;
}

describe('recommendation screen', () => {
  it('shows one recommended card and 1-2 alternatives, each with reasons and the time split for the chosen time', async () => {
    showSuggestion();
    await screen.findByRole('heading', { name: 'Our suggestion' });
    const cards = screen.getAllByRole('article');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(within(cards[0]!).getByText('Recommended')).toBeTruthy();
    for (const card of cards.slice(1)) expect(within(card).getByText('Alternative')).toBeTruthy();
    for (const card of cards) {
      expect(within(card).getByText('Why it fits')).toBeTruthy();
      expect(within(card).getByText(/Suggested time: 30 min/)).toBeTruthy();
      expect(within(card).getByText(/^Retrospective: 16/)).toBeTruthy(); // 5 + 3 + 8 from the generic split or a shifted one
    }
  });

  it('"Use this format" stores the choice and continues with session creation', async () => {
    const t = showSuggestion();
    await screen.findByRole('heading', { name: 'Our suggestion' });
    const first = screen.getAllByRole('article')[0]!;
    const name = within(first).getByRole('heading', { level: 3 }).textContent!;
    fireEvent.click(within(first).getByRole('button', { name: 'Use this format' }));
    await screen.findByRole('heading', { name: 'Chosen format' });
    expect(t.app.flow.chosen.value?.format.name).toBe(name);
    expect(t.app.flow.chosen.value?.timeBudgetMin).toBe(30);
    expect(t.app.flow.chosen.value?.answers).toEqual(answers);
  });

  it('does not show the weak-match note for a normal answer set', async () => {
    showSuggestion();
    await screen.findByRole('heading', { name: 'Our suggestion' });
    expect(screen.queryByText('Not a perfect fit, but closest to your answers')).toBeNull();
  });

  it('shows the weak-match note when the best match is weak, with the links to the library and the custom format', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    const weakLibrary = ['a', 'b', 'c'].map((id) =>
      sampleFormat({
        id,
        name: `Format ${id}`,
        fit: {
          mood: { energized: 0, neutral: 0, tired: 0, tense: 0 },
          goal: { fun: 0, bond: 0, 'reflect-period': 0, 'reflect-project': 0 },
          depth: { lean: 0, extensive: 0 },
          setting: { 'in-room': 0, remote: 0 },
        },
      }),
    );
    for (const [key, value] of Object.entries(answers))
      t.app.flow.setAnswer(key as keyof Answers, value as never);
    t.app.flow.recommendation.set(recommend(answers, weakLibrary, scoringConfig));
    t.app.flow.step.set('recommendation');
    expect(await screen.findByText('Not a perfect fit, but closest to your answers')).toBeTruthy();
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(2); // the best matches are still shown
    expect(screen.getByRole('button', { name: 'Browse all formats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create custom format' })).toBeTruthy();
  });

  it('"See details" opens the format and "Back" returns to the suggestion', async () => {
    showSuggestion();
    await screen.findByRole('heading', { name: 'Our suggestion' });
    const first = screen.getAllByRole('article')[0]!;
    const name = within(first).getByRole('heading', { level: 3 }).textContent!;
    fireEvent.click(within(first).getByRole('button', { name: 'See details' }));
    await screen.findByRole('heading', { level: 2, name });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Our suggestion' });
  });
});
