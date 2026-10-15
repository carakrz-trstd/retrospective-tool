import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { contribSession, goTo, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

type Dev = Awaited<ReturnType<typeof contribSession>>['host'];

function answer(d: Dev, retro: number, tool: number, retroComment = '', toolComment = '') {
  fireEvent.click(d.q.getByRole('radio', { name: `Retro rating ${retro}` }));
  fireEvent.click(d.q.getByRole('radio', { name: `Tool rating ${tool}` }));
  if (retroComment) type(d.q.getByLabelText('Comment about the retrospective (optional)'), retroComment);
  if (toolComment) type(d.q.getByLabelText('Comment about the tool (optional)'), toolComment);
}

describe('check-out survey (AC-11, AC-12, AC-21, AC-22)', () => {
  it('shows both rating groups and both comment fields; submit is disabled until both ratings are chosen', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'checkOut');
    const alex = people.Alex!;
    await alex.q.findByRole('radiogroup', { name: 'Retro rating' });
    expect(alex.q.getByRole('radiogroup', { name: 'Tool rating' })).toBeTruthy();
    expect(alex.q.getAllByRole('radio')).toHaveLength(10);
    expect(alex.q.getByLabelText('Comment about the retrospective (optional)')).toBeTruthy();
    expect(alex.q.getByLabelText('Comment about the tool (optional)')).toBeTruthy();
    const submit = alex.q.getByRole('button', { name: 'Submit answers' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(alex.q.getByRole('radio', { name: 'Retro rating 4' }));
    expect(submit.disabled).toBe(true);
    fireEvent.click(alex.q.getByRole('radio', { name: 'Tool rating 5' }));
    expect(submit.disabled).toBe(false);
  });

  it('submit stores the answer, says it can be changed until the Facilitator closes the survey, and a change keeps the count', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'checkOut');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByRole('radiogroup', { name: 'Retro rating' });
    expect(
      alex.q.getByText(/You can change your answers until the Facilitator closes the survey/),
    ).toBeTruthy();
    for (const d of [host, alex, blake]) expect(d.q.getByText('0 of 3 answered')).toBeTruthy();

    answer(alex, 4, 5, 'good retro', 'tool is fine');
    fireEvent.click(alex.q.getByRole('button', { name: 'Submit answers' }));
    answer(blake, 2, 3);
    fireEvent.click(blake.q.getByRole('button', { name: 'Submit answers' }));
    for (const d of [host, alex, blake]) await d.q.findByText('2 of 3 answered');

    // Alex changes the answer: the count stays 2 and the button now says "Update answers"
    fireEvent.click(alex.q.getByRole('radio', { name: 'Retro rating 1' }));
    fireEvent.click(alex.q.getByRole('button', { name: 'Update answers' }));
    await waitFor(() => expect(host.t.app.state.value!.extensions.contrib).toBeTruthy());
    for (const d of [host, alex, blake]) expect(d.q.getByText('2 of 3 answered')).toBeTruthy();
    expect((alex.q.getByRole('radio', { name: 'Retro rating 1' }) as HTMLInputElement).checked).toBe(true);
    // no results while the survey is open
    for (const d of [host, alex, blake]) expect(d.q.queryByText('Survey results')).toBeNull();
  });

  it('"Close survey" is for the Facilitator, asks for confirmation, and afterwards the results are final, read-only and without names', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'checkOut');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByRole('radiogroup', { name: 'Retro rating' });
    answer(alex, 4, 5, 'good retro', 'tool is fine');
    fireEvent.click(alex.q.getByRole('button', { name: 'Submit answers' }));
    answer(blake, 2, 3, 'too long');
    fireEvent.click(blake.q.getByRole('button', { name: 'Submit answers' }));
    await host.q.findByText('2 of 3 answered');

    expect(alex.q.queryByRole('button', { name: 'Close survey' })).toBeNull();
    fireEvent.click(host.q.getByRole('button', { name: 'Close survey' }));
    const dialog = host.q.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close survey' }));

    for (const d of [host, alex, blake]) {
      await d.q.findByText('Survey results');
      expect(d.q.getByText('good retro')).toBeTruthy();
      expect(d.q.getByText('tool is fine')).toBeTruthy();
      expect(d.q.getByText('too long')).toBeTruthy();
      expect(d.q.getByText('Retrospective: average 3.0 (2 answers)')).toBeTruthy();
      expect(d.q.getByText('Tool: average 4.0 (2 answers)')).toBeTruthy();
      // the comments carry no names
      expect(d.container.querySelector('.survey-results')!.textContent).not.toMatch(/Alex|Blake/);
      expect(d.q.queryByRole('button', { name: /Submit answers|Update answers/ })).toBeNull();
      expect((d.q.getAllByRole('radio')[0] as HTMLInputElement).disabled).toBe(true);
    }
  });
});
