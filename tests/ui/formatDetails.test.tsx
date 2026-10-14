import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { getFormat } from '../../src/formats/library';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => cleanup());

async function openDetails(formatName: string, answers = false) {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  if (answers) {
    t.app.flow.setAnswer('mood', 'neutral');
    t.app.flow.setAnswer('goal', 'reflect-project');
    t.app.flow.setAnswer('timeBudgetMin', 80);
    t.app.flow.setAnswer('depth', 'extensive');
    t.app.flow.setAnswer('setting', 'remote');
  }
  fireEvent.click(screen.getByRole('button', { name: 'Browse all formats' }));
  const card = await screen.findByRole('article', { name: formatName });
  fireEvent.click(within(card).getByRole('button', { name: 'See details' }));
  await screen.findByRole('heading', { level: 2, name: formatName });
  return t;
}

describe('format details screen', () => {
  it('shows description, columns with prompts, time splits, check-in question, tips and the attribution link', async () => {
    await openDetails('Starfish');
    const f = getFormat('starfish')!;
    expect(screen.getByText(f.description)).toBeTruthy();
    for (const c of f.columns) {
      expect(screen.getByText(c.name)).toBeTruthy();
      expect(screen.getByText(new RegExp(c.prompt!.slice(0, 15)))).toBeTruthy();
    }
    // no time answer yet: every supported time is shown
    expect(screen.getByText(/Suggested time: 50 min/)).toBeTruthy();
    expect(screen.getByText(/Suggested time: 80 min/)).toBeTruthy();
    expect(screen.queryByText(/Suggested time: 30 min/)).toBeNull();
    expect(screen.getByText(f.checkInQuestion)).toBeTruthy();
    for (const tip of f.facilitationTips) expect(screen.getByText(tip)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Based on Starfish on funretrospectives.com' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/(www\.)?funretrospectives\.com/);
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('a format without a confirmed source shows neutral wording instead of a link', async () => {
    await openDetails('Sailboat');
    expect(screen.getByText('A widely used retrospective format.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /funretrospectives/ })).toBeNull();
  });

  it('shows only the time split of the chosen time when the time was answered', async () => {
    await openDetails('Starfish', true);
    expect(screen.getByText(/Suggested time: 80 min/)).toBeTruthy();
    expect(screen.queryByText(/Suggested time: 50 min/)).toBeNull();
  });

  it('the app footer carries the credit line', async () => {
    await openDetails('Starfish');
    expect(
      screen.getByText(
        'Some of the retrospective formats are based on activities from funretrospectives.com.',
      ),
    ).toBeTruthy();
  });

  it('"Use this format" works for any format; without a time answer the time step offers only the supported times', async () => {
    const t = await openDetails('Starfish');
    fireEvent.click(screen.getByRole('button', { name: 'Use this format' }));
    await screen.findByRole('heading', { name: 'How much time do you have?' });
    expect(screen.getByRole('radio', { name: '50 min' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '80 min' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: '30 min' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '50 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Chosen format' });
    expect(t.app.flow.chosen.value?.format.id).toBe('starfish');
    expect(t.app.flow.chosen.value?.timeBudgetMin).toBe(50);
  });

  it('a format that does not support the time already answered asks for another time', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    for (const [k, v] of Object.entries({
      mood: 'neutral',
      goal: 'fun',
      timeBudgetMin: 30,
      depth: 'lean',
      setting: 'remote',
    })) {
      t.app.flow.setAnswer(k as 'mood', v as never);
    }
    t.app.flow.useFormat(getFormat('starfish')!); // Starfish has no 30 minute option
    await screen.findByRole('heading', { name: 'How much time do you have?' });
    expect(screen.queryByRole('radio', { name: '30 min' })).toBeNull();
  });

  it('"Use as basis" opens the custom form with the copied columns', async () => {
    await openDetails('Starfish');
    fireEvent.click(screen.getByRole('button', { name: 'Use as basis' }));
    await screen.findByRole('heading', { name: 'Create a custom format' });
    expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('Keep doing');
    expect(screen.getByLabelText('Column 5 name')).toBeTruthy();
  });
});
