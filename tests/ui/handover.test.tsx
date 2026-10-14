import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/preact';
import { getFormat } from '../../src/formats/library';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { chooseFormat, makeApp, renderApp } from '../appHelpers';

afterEach(() => cleanup());

describe('hand-over to session creation', () => {
  it('after "Use this format" the create page shows the chosen format, its columns and the time budget', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    for (const name of ['Neutral', 'Reflect on a specific project', '80 minutes', 'Extensive', 'Remote']) {
      fireEvent.click(screen.getByRole('radio', { name }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Show recommendation' }));
    await screen.findByRole('heading', { name: 'Our suggestion' });
    const first = screen.getAllByRole('article')[0]!;
    const name = within(first).getByRole('heading', { level: 3 }).textContent!;
    fireEvent.click(within(first).getByRole('button', { name: 'Use this format' }));
    const section = (await screen.findByRole('heading', { name: 'Chosen format' })).closest('section')!;
    expect(within(section).getByText(name)).toBeTruthy();
    expect(within(section).getByText(/80 min/)).toBeTruthy();
    const format = getFormat(t.app.flow.chosen.value!.format.id)!;
    expect(within(section).getByText(new RegExp(format.columns[0]!.name))).toBeTruthy();
    expect(screen.getByLabelText('Your name')).toBeTruthy();
  });

  it('a created session contains the chosen format and time budget in its state', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    t.app.flow.useFormat(getFormat('sailboat')!); // no answers: asks for the time
    await screen.findByRole('heading', { name: 'How much time do you have?' });
    fireEvent.click(screen.getByRole('radio', { name: '80 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Chosen format' });
    fireEvent.input(screen.getByLabelText('Your name'), { target: { value: 'Fiona' } });
    fireEvent.input(screen.getByLabelText('Your role'), { target: { value: 'Scrum Master' } });
    fireEvent.submit(document.querySelector('form')!);
    await screen.findByRole('heading', { name: /^Lobby/ });
    const state = t.app.state.value!;
    expect(state.format.id).toBe('sailboat');
    expect(state.format.columns.map((c) => c.name)).toEqual(['Wind', 'Anchors', 'Rocks', 'Island']);
    expect(state.timeBudgetMin).toBe(80);
  });

  it('"Change format" on the create page returns to the questionnaire', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    chooseFormat(t.app, 'sailboat', 80);
    await screen.findByRole('heading', { name: 'Chosen format' });
    fireEvent.click(screen.getByRole('button', { name: 'Change format' }));
    await screen.findByRole('heading', { name: 'Choose a retrospective format' });
    expect(t.app.flow.chosen.value).toBeNull();
  });

  it('opening the create page without a chosen format starts the format selection', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/create' });
    renderApp(t);
    await screen.findByRole('heading', { name: 'Choose a retrospective format' });
  });

  it('the "Create session" button on the start page starts the format selection', async () => {
    renderApp(makeApp(new MemoryNetwork()));
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    await screen.findByRole('heading', { name: 'Choose a retrospective format' });
  });
});
