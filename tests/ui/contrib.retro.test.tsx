import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/preact';
import { getFormat } from '../../src/formats/library';
import { contribSession, goTo, resetContrib, type } from './contribHelpers';

afterEach(() => {
  cleanup();
  resetContrib();
});

const format = getFormat('start-stop-continue')!;

async function addEntry(d: Awaited<ReturnType<typeof contribSession>>['host'], column: string, text: string) {
  type(d.q.getByLabelText(`New entry for ${column}`), text);
  fireEvent.click(d.q.getByRole('button', { name: `Add entry to ${column}` }));
  await d.q.findByText(text);
}

describe('retro board (AC-2, AC-3, AC-4, AC-5, AC-15, AC-16, AC-18)', () => {
  it("shows the format's columns and prompts", async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'retro.write');
    for (const d of [host, people.Alex!]) {
      for (const col of format.columns) {
        await d.q.findByRole('heading', { name: col.name });
        if (col.prompt) expect(d.q.getByText(col.prompt)).toBeTruthy();
      }
    }
  });

  it('the board is stacked by default and spreads out only on wide screens (mobile first)', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const rule = css.match(/\.retro-board\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('grid');
    expect(rule).not.toMatch(/grid-template-columns:\s*repeat/);
    expect(css).toMatch(/@media \(min-width: \d+px\)\s*\{[^@]*\.retro-board/);
  });

  it('adding an entry takes three interactions: tap the field, type, tap Add', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'retro.write');
    const alex = people.Alex!;
    const field = await alex.q.findByLabelText('New entry for Start');
    fireEvent.click(field); // 1 tap the field
    type(field, 'Pair on reviews'); // 2 type
    fireEvent.click(alex.q.getByRole('button', { name: 'Add entry to Start' })); // 3 tap Add
    await alex.q.findByText('Pair on reviews');
    expect((field as HTMLTextAreaElement).value).toBe(''); // ready for the next entry
  });

  it("before the reveal only own entries are shown; own entries have edit and delete, others' do not; after the reveal all are shown with names", async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    const [alex, blake] = [people.Alex!, people.Blake!];
    goTo(host, 'retro.write');
    await alex.q.findByLabelText('New entry for Start');
    await addEntry(alex, 'Start', 'alex start');
    await addEntry(blake, 'Stop', 'blake stop');
    expect(alex.q.queryByText('blake stop')).toBeNull();
    expect(host.q.queryByText('alex start')).toBeNull();
    const own = alex.q.getByText('alex start').closest('li')!;
    expect(within(own).getByRole('button', { name: 'Edit entry' })).toBeTruthy();
    expect(within(own).getByRole('button', { name: 'Delete entry' })).toBeTruthy();

    host.t.app.flowIntent('flow.reveal', { key: 'retro' });
    for (const d of [host, alex, blake]) {
      await d.q.findByText('alex start');
      await d.q.findByText('blake stop');
    }
    const theirs = alex.q.getByText('blake stop').closest('li')!;
    expect(within(theirs).getByText('Blake')).toBeTruthy();
    expect(within(theirs).queryByRole('button', { name: 'Edit entry' })).toBeNull();
    expect(within(theirs).queryByRole('button', { name: 'Delete entry' })).toBeNull();
    // the Facilitator can delete every entry but edits none
    const forFacilitator = host.q.getByText('blake stop').closest('li')!;
    expect(within(forFacilitator).getByRole('button', { name: 'Delete entry' })).toBeTruthy();
    expect(within(forFacilitator).queryByRole('button', { name: 'Edit entry' })).toBeNull();
  });

  it('an entry added after the reveal appears at once for everybody; the author can edit and delete', async () => {
    const { host, people } = await contribSession({ participants: ['Alex', 'Blake'] });
    const [alex, blake] = [people.Alex!, people.Blake!];
    goTo(host, 'retro.write');
    await alex.q.findByLabelText('New entry for Start');
    host.t.app.flowIntent('flow.reveal', { key: 'retro' });
    await addEntry(blake, 'Continue', 'late entry');
    for (const d of [host, alex]) await d.q.findByText('late entry');

    const item = blake.q.getByText('late entry').closest('li')!;
    fireEvent.click(within(item).getByRole('button', { name: 'Edit entry' }));
    type(blake.q.getByLabelText('Entry text'), 'edited entry');
    fireEvent.click(blake.q.getByRole('button', { name: 'Save' }));
    await alex.q.findByText('edited entry');
    fireEvent.click(
      within(blake.q.getByText('edited entry').closest('li')!).getByRole('button', { name: 'Delete entry' }),
    );
    await waitFor(() => expect(alex.q.queryByText('edited entry')).toBeNull());
  });

  it('the Facilitator deletes an entry of a participant and it disappears for everybody', async () => {
    const { host, people } = await contribSession({ participants: ['Alex'] });
    goTo(host, 'retro.write');
    const alex = people.Alex!;
    await alex.q.findByLabelText('New entry for Stop');
    host.t.app.flowIntent('flow.reveal', { key: 'retro' });
    await addEntry(alex, 'Stop', 'remove me');
    await host.q.findByText('remove me');
    fireEvent.click(
      within(host.q.getByText('remove me').closest('li')!).getByRole('button', { name: 'Delete entry' }),
    );
    await waitFor(() => expect(alex.q.queryByText('remove me')).toBeNull());
    expect(host.q.queryByText('remove me')).toBeNull();
  });
});
