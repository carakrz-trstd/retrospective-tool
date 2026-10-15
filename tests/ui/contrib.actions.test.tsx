import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { contribSession, goTo, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

describe('action items (AC-8, AC-9, AC-10, AC-16, AC-23)', () => {
  it('saving without a description or without an owner shows an inline message', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'actions');
    const alex = people.Alex!;
    await alex.q.findByLabelText('Action description');
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));
    expect(alex.q.getByText('Please describe the action.')).toBeTruthy();

    type(alex.q.getByLabelText('Action description'), 'Write the docs');
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));
    expect(alex.q.getByText('Please choose at least one owner.')).toBeTruthy();
    expect(alex.q.queryByText('Write the docs', { selector: 'li *' })).toBeNull();
  });

  it('owners can be chosen only from the participants of the session; several owners and an optional due date', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'actions');
    const alex = people.Alex!;
    await alex.q.findByLabelText('Action description');
    const owners = within(alex.q.getByRole('group', { name: 'Owners' }));
    expect(
      owners
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label') ?? c.parentElement!.textContent),
    ).toEqual(['Fiona', 'Alex', 'Blake']);

    type(alex.q.getByLabelText('Action description'), 'Fix the build');
    fireEvent.click(owners.getByLabelText('Alex'));
    fireEvent.click(owners.getByLabelText('Blake'));
    type(alex.q.getByLabelText('Due date (optional)'), '2026-03-01');
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));
    for (const d of [host, alex, people.Blake!]) {
      const item = (await d.q.findByText('Fix the build')).closest('li')!;
      expect(within(item).getByText('Owners: Alex, Blake')).toBeTruthy();
      expect(within(item).getByText('Due: 2026-03-01')).toBeTruthy();
    }
    // the form is empty again
    expect((alex.q.getByLabelText('Action description') as HTMLTextAreaElement).value).toBe('');
  });

  it('the due date is optional', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'actions');
    const alex = people.Alex!;
    await alex.q.findByLabelText('Action description');
    type(alex.q.getByLabelText('Action description'), 'No date');
    fireEvent.click(within(alex.q.getByRole('group', { name: 'Owners' })).getByLabelText('Alex'));
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));
    const item = (await host.q.findByText('No date')).closest('li')!;
    expect(within(item).queryByText(/^Due:/)).toBeNull();
  });

  it('any participant can edit; delete is for the Facilitator only', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'actions');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByLabelText('Action description');
    type(alex.q.getByLabelText('Action description'), 'Original');
    fireEvent.click(within(alex.q.getByRole('group', { name: 'Owners' })).getByLabelText('Alex'));
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));

    const item = (await blake.q.findByText('Original')).closest('li')!;
    expect(within(item).queryByRole('button', { name: 'Delete action item' })).toBeNull();
    fireEvent.click(within(item).getByRole('button', { name: 'Edit action item' }));
    const form = within(blake.q.getByRole('form', { name: 'Edit action item' }));
    type(form.getByLabelText('Action description'), 'Changed by Blake');
    fireEvent.click(form.getByLabelText('Blake'));
    fireEvent.click(form.getByRole('button', { name: 'Save action item' }));
    for (const d of [host, alex, blake]) {
      const changed = (await d.q.findByText('Changed by Blake')).closest('li')!;
      expect(within(changed).getByText('Owners: Alex, Blake')).toBeTruthy();
    }

    const forHost = host.q.getByText('Changed by Blake').closest('li')!;
    fireEvent.click(within(forHost).getByRole('button', { name: 'Delete action item' }));
    await waitFor(() => expect(alex.q.queryByText('Changed by Blake')).toBeNull());
  });

  it('after the owner is removed from the session the item remains and shows the name as plain text', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    goTo(host, 'actions');
    const [alex, blake] = [people.Alex!, people.Blake!];
    await alex.q.findByLabelText('Action description');
    type(alex.q.getByLabelText('Action description'), 'Blake does it');
    fireEvent.click(within(alex.q.getByRole('group', { name: 'Owners' })).getByLabelText('Blake'));
    fireEvent.click(alex.q.getByRole('button', { name: 'Save action item' }));
    await host.q.findByText('Blake does it');

    host.t.app.removeParticipant(blake.t.app.myParticipantId.value!);
    await waitFor(() =>
      expect(
        within(host.q.getByText('Blake does it').closest('li')!).getByText('Owners: Blake'),
      ).toBeTruthy(),
    );
    const item = alex.q.getByText('Blake does it').closest('li')!;
    expect(within(item).getByText('Owners: Blake')).toBeTruthy();
    // a removed person is not offered as a new owner
    const names = within(alex.q.getByRole('group', { name: 'Owners' })).getAllByRole('checkbox');
    expect(names).toHaveLength(2);
  });
});
