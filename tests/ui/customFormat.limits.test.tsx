import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/preact';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { makeApp, renderApp } from '../appHelpers';

afterEach(() => cleanup());

async function openCustom() {
  const t = makeApp(new MemoryNetwork(), { hash: '#/new' });
  renderApp(t);
  fireEvent.click(screen.getByRole('button', { name: 'Create custom format' }));
  await screen.findByLabelText('Column 1 name');
  return t;
}

const type = (label: string, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

describe('custom format limits', () => {
  it('the name input stops at 30 characters and the prompt input at 120, with a remaining-characters hint', async () => {
    await openCustom();
    expect(screen.getByLabelText('Column 1 name').getAttribute('maxlength')).toBe('30');
    expect(screen.getByLabelText('Column 1 prompt (optional)').getAttribute('maxlength')).toBe('120');
    expect(screen.getAllByText('30 characters left').length).toBeGreaterThan(0);
    type('Column 1 name', 'Ideas');
    expect(await screen.findByText('25 characters left')).toBeTruthy();
    type('Column 1 prompt (optional)', 'x'.repeat(20));
    expect(await screen.findByText('100 characters left')).toBeTruthy();
  });

  it('two columns named "Ideas" and "ideas" show an inline message and block saving', async () => {
    const t = await openCustom();
    type('Column 1 name', 'Ideas');
    type('Column 2 name', 'ideas');
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Column names must be different from each other.')).toBeTruthy();
    expect(t.app.flow.chosen.value).toBeNull();
  });

  it('a name or prompt that is too long (pasted in) shows an inline message and blocks saving', async () => {
    const t = await openCustom();
    type('Column 1 name', 'n'.repeat(31));
    type('Column 2 name', 'Fine');
    type('Column 2 prompt (optional)', 'p'.repeat(121));
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('This name is too long.')).toBeTruthy();
    expect(screen.getByText('This prompt is too long.')).toBeTruthy();
    expect(t.app.flow.chosen.value).toBeNull();
  });
});
