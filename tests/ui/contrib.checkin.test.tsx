import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { getFormat } from '../../src/formats/library';
import { contribSession, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

const question = getFormat('start-stop-continue')!.checkInQuestion;

describe('check-in screen (AC-1, AC-4, AC-17)', () => {
  it("shows the format's check-in question and a response can be added once and then edited", async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    expect(host.q.getByText(question)).toBeTruthy();
    const alex = people.Alex!;
    await alex.q.findByText(question);

    type(alex.q.getByLabelText('Your check-in response'), 'Sleepy but here');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add response' }));
    await alex.q.findByText('Sleepy but here');
    // the composer became an editor: no second response can be added
    expect(alex.q.queryByRole('button', { name: 'Add response' })).toBeNull();

    fireEvent.click(alex.q.getByRole('button', { name: 'Edit entry' }));
    type(alex.q.getByLabelText('Entry text'), 'Awake now');
    fireEvent.click(alex.q.getByRole('button', { name: 'Save' }));
    await alex.q.findByText('Awake now');
    expect(alex.q.queryByText('Sleepy but here')).toBeNull();
  });

  it('shows the remaining characters and the input stops at 280', async () => {
    const { people } = await contribSession({ participants: ['Alex'] });
    const alex = people.Alex!;
    const field = alex.q.getByLabelText('Your check-in response') as HTMLTextAreaElement;
    expect(alex.q.getByText('280 characters left')).toBeTruthy();
    type(field, 'a'.repeat(100));
    expect(alex.q.getByText('180 characters left')).toBeTruthy();
    type(field, 'b'.repeat(281));
    await waitFor(() => expect(field.value).toHaveLength(280));
    expect(alex.q.getByText('0 characters left')).toBeTruthy();
  });

  it('Add is disabled while the field is empty', async () => {
    const { people } = await contribSession({ participants: ['Alex'] });
    const add = people.Alex!.q.getByRole('button', { name: 'Add response' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    type(people.Alex!.q.getByLabelText('Your check-in response'), '   ');
    expect(add.disabled).toBe(true);
  });

  it("others' responses are hidden before the reveal and shown with author names after it", async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    const [alex, blake] = [people.Alex!, people.Blake!];
    type(alex.q.getByLabelText('Your check-in response'), 'from Alex');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add response' }));
    type(blake.q.getByLabelText('Your check-in response'), 'from Blake');
    fireEvent.click(blake.q.getByRole('button', { name: 'Add response' }));
    await alex.q.findByText('from Alex');
    expect(alex.q.queryByText('from Blake')).toBeNull();
    await host.q.findByText('2 of 3 have added something');
    expect(host.q.queryByText('from Alex')).toBeNull();

    host.t.app.flowIntent('flow.reveal', { key: 'checkIn' });
    for (const d of [host, alex, blake]) {
      const a = (await d.q.findByText('from Alex')).closest('li')!;
      const b = (await d.q.findByText('from Blake')).closest('li')!;
      expect(within(a).getByText('Alex')).toBeTruthy();
      expect(within(b).getByText('Blake')).toBeTruthy();
    }
  });
});
