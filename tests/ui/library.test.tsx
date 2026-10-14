import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { listFormats } from '../../src/formats/library';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => cleanup());

function openLibrary() {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  fireEvent.click(screen.getByRole('button', { name: 'Browse all formats' }));
  return t;
}

describe('library screen', () => {
  it('shows 12 cards with names, derived tags and supported durations', async () => {
    openLibrary();
    await screen.findByRole('heading', { name: 'All formats' });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(12);
    const names = cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent);
    expect(names).toEqual(listFormats().map((f) => f.name));
    const starfish = screen.getByRole('article', { name: 'Starfish' });
    expect(within(starfish).getByText(/Works for 50, 80 min/)).toBeTruthy();
    expect(within(starfish).getByText(/Depth: extensive/)).toBeTruthy();
    expect(
      within(starfish).getByText(/Keep doing · Less of · More of · Start doing · Stop doing/),
    ).toBeTruthy();
  });

  it('a card opens the details of that format', async () => {
    openLibrary();
    const card = await screen.findByRole('article', { name: 'Sailboat' });
    fireEvent.click(within(card).getByRole('button', { name: 'See details' }));
    await screen.findByRole('heading', { level: 2, name: 'Sailboat' });
  });

  it('"Back to the questions" returns to the questionnaire', async () => {
    openLibrary();
    await screen.findByRole('heading', { name: 'All formats' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the questions' }));
    await screen.findByRole('heading', { name: 'Choose a retrospective format' });
  });
});
