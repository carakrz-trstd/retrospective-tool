import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { contribSession, goTo, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

describe('empty states: an icon and a one-line hint', () => {
  it('each retro column says "No entries yet." until it has an entry', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'retro.write');
    const alex = people.Alex!;
    await alex.q.findByLabelText('New entry for Start');
    expect(alex.q.getAllByText('No entries yet.')).toHaveLength(3);
    type(alex.q.getByLabelText('New entry for Start'), 'first idea');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add entry to Start' }));
    await alex.q.findByText('first idea');
    await waitFor(() => expect(alex.q.getAllByText('No entries yet.')).toHaveLength(2));
  });

  it('the hint has a decorative icon, is one short line, and is not part of the list', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'retro.write');
    const alex = people.Alex!;
    const hint = (await alex.q.findAllByText('No entries yet.'))[0]!;
    const box = hint.closest('.empty-state')!;
    expect(box).toBeTruthy();
    expect(box.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(box.textContent!.length).toBeLessThan(60);
    expect(box.closest('ul')).toBeNull();
    // the list itself stays empty (no placeholder item)
    expect(alex.container.querySelectorAll('.retro-column li').length).toBe(0);
  });

  it('the check-in says "No responses yet."', async () => {
    const { people } = await contribSession({ participants: ['Alex'] });
    const alex = people.Alex!;
    await alex.q.findByLabelText('Your check-in response');
    expect(alex.q.getByText('No responses yet.')).toBeTruthy();
    type(alex.q.getByLabelText('Your check-in response'), 'here');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add response' }));
    await waitFor(() => expect(alex.q.queryByText('No responses yet.')).toBeNull());
  });

  it('the notes say "No notes yet." and the action list "No action items yet."', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    const alex = people.Alex!;
    goTo(host, 'notes');
    await alex.q.findByLabelText('New note');
    expect(alex.q.getByText('No notes yet.')).toBeTruthy();
    type(alex.q.getByLabelText('New note'), 'a note');
    fireEvent.click(alex.q.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(alex.q.queryByText('No notes yet.')).toBeNull());

    goTo(host, 'actions');
    await alex.q.findByLabelText('Action description');
    expect(alex.q.getByText('No action items yet.')).toBeTruthy();
  });
});
