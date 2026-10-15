import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { contribSession, goTo, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

describe('discussion notes (AC-6, AC-7, AC-16, AC-24)', () => {
  it('everyone can add note items and everybody sees them', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'notes');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByLabelText('New note');
    type(alex.q.getByLabelText('New note'), 'We decided X');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add note' }));
    type(blake.q.getByLabelText('New note'), 'Open question Y');
    fireEvent.click(blake.q.getByRole('button', { name: 'Add note' }));
    for (const d of [host, alex, blake]) {
      await d.q.findByText('We decided X');
      await d.q.findByText('Open question Y');
    }
  });

  it('anyone can edit any item; the later text replaces the earlier one for everybody', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'notes');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await blake.q.findByLabelText('New note');
    type(blake.q.getByLabelText('New note'), 'Blake wrote this');
    fireEvent.click(blake.q.getByRole('button', { name: 'Add note' }));
    const item = (await alex.q.findByText('Blake wrote this')).closest('li')!;
    fireEvent.click(within(item).getByRole('button', { name: 'Edit note' }));
    type(alex.q.getByLabelText('Note text'), 'Alex changed it');
    fireEvent.click(alex.q.getByRole('button', { name: 'Save' }));
    for (const d of [host, alex, blake]) await d.q.findByText('Alex changed it');
    expect(blake.q.queryByText('Blake wrote this')).toBeNull();
  });

  it('the note taker label is shown to everybody; the control and delete are for the Facilitator only', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'notes');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByLabelText('New note');
    expect(alex.q.queryByLabelText('Note taker')).toBeNull();

    const select = host.q.getByLabelText('Note taker') as HTMLSelectElement;
    const blakeOption = [...select.options].find((o) => o.text === 'Blake')!;
    fireEvent.change(select, { target: { value: blakeOption.value } });
    for (const d of [host, alex, blake]) await d.q.findByText('Note taker: Blake');

    // anyone can still write
    type(alex.q.getByLabelText('New note'), 'still writing');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add note' }));
    await blake.q.findByText('still writing');

    const own = alex.q.getByText('still writing').closest('li')!;
    expect(within(own).queryByRole('button', { name: 'Delete note' })).toBeNull();
    const forHost = (await host.q.findByText('still writing')).closest('li')!;
    fireEvent.click(within(forHost).getByRole('button', { name: 'Delete note' }));
    await waitFor(() => expect(blake.q.queryByText('still writing')).toBeNull());
    expect(alex.q.queryByText('still writing')).toBeNull();

    // clearing the note taker
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(alex.q.queryByText('Note taker: Blake')).toBeNull());
  });
});
