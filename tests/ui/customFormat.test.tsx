import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/preact';
import { defaults } from '../../src/formats/defaults';
import { getFormat } from '../../src/formats/library';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openCustom() {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  fireEvent.click(screen.getByRole('button', { name: 'Create custom format' }));
  return t;
}

const type = (label: string, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

describe('custom format screen', () => {
  it('from scratch the form shows 2 empty columns', async () => {
    openCustom();
    await screen.findByRole('heading', { name: 'Create a custom format' });
    expect(screen.getByLabelText('Column 1 name')).toBeTruthy();
    expect(screen.getByLabelText('Column 2 name')).toBeTruthy();
    expect(screen.queryByLabelText('Column 3 name')).toBeNull();
    expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('');
  });

  it('"Add column" is disabled at 4 columns, "Remove column" is disabled at 2', async () => {
    openCustom();
    await screen.findByRole('heading', { name: 'Create a custom format' });
    expect((screen.getByRole('button', { name: 'Remove column 1' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const add = screen.getByRole('button', { name: 'Add column' }) as HTMLButtonElement;
    fireEvent.click(add);
    fireEvent.click(add);
    await screen.findByLabelText('Column 4 name');
    expect(add.disabled).toBe(true);
    expect(screen.queryByLabelText('Column 5 name')).toBeNull();
    expect((screen.getByRole('button', { name: 'Remove column 1' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('empty names show an inline message and block saving', async () => {
    const t = openCustom();
    await screen.findByRole('heading', { name: 'Create a custom format' });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect((await screen.findAllByText('Please give this column a name.')).length).toBe(2);
    expect(t.app.flow.chosen.value).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create a custom format' })).toBeTruthy();
  });

  it('the check-in select lists only the generic questions', async () => {
    openCustom();
    const select = (await screen.findByLabelText('Check-in question')) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(defaults.checkInQuestions);
    fireEvent.change(select, { target: { value: defaults.checkInQuestions[3] } });
    await waitFor(() => expect(select.value).toBe(defaults.checkInQuestions[3]));
  });

  it('"Use as basis" with Starfish shows 5 columns, "Add column" is disabled, removing one is possible', async () => {
    const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
    renderApp(t);
    t.app.flow.openDetails('starfish', 'library');
    t.app.flow.useAsBasis('starfish');
    await screen.findByLabelText('Column 5 name');
    expect((screen.getByRole('button', { name: 'Add column' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove column 5' }));
    await waitFor(() => expect(screen.queryByLabelText('Column 5 name')).toBeNull());
    expect((screen.getByRole('button', { name: 'Add column' }) as HTMLButtonElement).disabled).toBe(true); // the limit is 4
    expect(getFormat('starfish')!.columns).toHaveLength(5); // the library is untouched
  });

  it('saving a valid format hands over the choice (after asking for the time when none was answered)', async () => {
    const t = openCustom();
    await screen.findByLabelText('Column 1 name');
    type('Column 1 name', 'Ideas');
    type('Column 2 name', 'Problems');
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByRole('heading', { name: 'How much time do you have?' });
    expect(screen.getByRole('radio', { name: '30 min' })).toBeTruthy(); // a custom format offers all three
    expect(screen.getByRole('radio', { name: '50 min' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '80 min' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '30 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Chosen format' });
    expect(t.app.flow.chosen.value?.format.custom).toBe(true);
    expect(t.app.flow.chosen.value?.format.columns.map((c) => c.name)).toEqual(['Ideas', 'Problems']);
    expect(t.app.flow.chosen.value?.format.timeSplits['30']).toEqual(defaults.timeSplits['30']);
  });

  it('a reload (starting again from scratch) loses the draft and nothing is stored', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const t = openCustom();
    await screen.findByLabelText('Column 1 name');
    type('Column 1 name', 'Ideas');
    expect(setItem).not.toHaveBeenCalled();
    cleanup();
    const again = makeApp(new MemoryNetwork(), { hash: '#/new/custom' }); // a reload at the custom address
    renderApp(again);
    await screen.findByRole('heading', { name: 'Choose a retrospective format' }); // back at the questionnaire
    expect(again.app.flow.draft.value).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    void t;
  });
});
