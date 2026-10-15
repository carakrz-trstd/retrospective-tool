import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { DOC_VERSION } from '../../src/doc/model';
import { createCustomFromScratch } from '../../src/formats/custom';
import { A, B, F, makeState, must, reveal } from '../contrib/stateBuilder';
import { CAROL, sampleSession } from './sample';

describe('buildDocumentModel (AC-1, AC-2, AC-3, AC-19, AC-21, NFR-6)', () => {
  const model = buildDocumentModel(sampleSession(), { incomplete: false });

  it('has the heading, date, format, time budget and participants with roles (Facilitator first, removed not listed)', () => {
    expect(model.version).toBe(DOC_VERSION);
    expect(model.incomplete).toBe(false);
    expect(model.heading).toBe('Retrospective, 2026-03-01, Start-Stop-Continue');
    expect(model.title).toBeUndefined();
    expect(model.date).toBe('2026-03-01');
    expect(model.timeBudgetMin).toBe(50);
    expect(model.format).toMatchObject({ name: 'Start-Stop-Continue', custom: false });
    expect(model.format.columns.map((c) => c.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(model.participants).toEqual([
      { name: 'Fiona', role: 'Scrum Master', isFacilitator: true },
      { name: 'Alex', role: 'Developer', isFacilitator: false },
      { name: 'Blake', role: 'Tester', isFacilitator: false },
    ]);
  });

  it('has check-in responses, retro entries per column and notes with author names', () => {
    expect(model.checkIn.question).toBe('How are you arriving today?');
    expect(model.checkIn.responses).toEqual([
      { author: 'Alex', text: 'sleepy but here' },
      { author: 'Blake', text: 'fine' },
    ]);
    expect(model.retro.columns.map((c) => [c.name, c.entries])).toEqual([
      ['Alpha', [{ author: 'Alex', text: 'start testing' }]],
      ['Beta', [{ author: 'Blake', text: 'stop meetings' }]],
      ['Gamma', []],
    ]);
    expect(model.notes).toEqual({ noteTaker: 'Blake', items: [{ text: 'we agreed on X', author: 'Alex' }] });
  });

  it('has action items with owners as names and due dates, and the survey results without names', () => {
    expect(model.actions).toEqual([
      { description: 'write the docs', owners: ['Alex', 'Blake'], dueDate: '2026-03-15' },
    ]);
    expect(model.survey.answered).toBe(2);
    expect(model.survey.retro).toEqual({
      average: 4.5,
      distribution: [0, 0, 0, 1, 1],
      comments: ['great retro'],
    });
    expect(model.survey.tool).toEqual({
      average: 3.5,
      distribution: [0, 0, 1, 1, 0],
      comments: ['slow on my phone'],
    });
  });

  it('uses the title as heading when it was entered, and ignores a blank one', () => {
    const titled = buildDocumentModel(sampleSession({ title: 'Team Alpha' }), { incomplete: false });
    expect(titled.heading).toBe('Team Alpha');
    expect(titled.title).toBe('Team Alpha');
    const blank = buildDocumentModel({ ...sampleSession(), title: '   ' }, { incomplete: false });
    expect(blank.heading).toBe('Retrospective, 2026-03-01, Start-Stop-Continue');
  });

  it('a custom format lists its own columns and custom: true', () => {
    const custom = createCustomFromScratch();
    custom.columns = [
      { id: 'x', name: 'Went well', prompt: 'What worked?' },
      { id: 'y', name: 'Went badly' },
    ];
    const state = { ...sampleSession(), format: custom };
    const m = buildDocumentModel(state, { incomplete: false });
    expect(m.format.custom).toBe(true);
    expect(m.format.columns).toEqual([{ name: 'Went well', prompt: 'What worked?' }, { name: 'Went badly' }]);
    expect(m.retro.columns.map((c) => c.name)).toEqual(['Went well', 'Went badly']);
  });

  it('never contains unrevealed entries, also not the own ones when built from a participant view', () => {
    const hidden = buildDocumentModel(sampleSession({ hidden: true }), { incomplete: false });
    expect(hidden.checkIn.responses).toEqual([]);
    expect(hidden.retro.columns.every((c) => c.entries.length === 0)).toBe(true);
    // a participant's last view: only the own entries are in it, and they are not revealed either
    let view = makeState();
    view = must(view, A, 'entry.add', { id: 'own', kind: 'retro', columnId: 'a', text: 'my hidden entry' });
    const fromView = buildDocumentModel(view, { incomplete: true });
    expect(JSON.stringify(fromView)).not.toContain('my hidden entry');
    const revealed = buildDocumentModel(reveal(view, 'retro'), { incomplete: true });
    expect(JSON.stringify(revealed)).toContain('my hidden entry');
  });

  it('leaves out entries of removed participants', () => {
    const json = JSON.stringify(model);
    expect(json).not.toContain('carol');
    expect(json).not.toContain('Carol');
  });

  it('contains no participant IDs, tokens or survey answer keys', () => {
    const state = sampleSession();
    const json = JSON.stringify(buildDocumentModel(state, { incomplete: false }));
    for (const id of [F, A, B, CAROL, 'key-one', 'key-two', state.sessionId, state.joinCode]) {
      expect(json).not.toContain(id);
    }
  });

  it('sets incomplete from the option; with no contributions every list is empty and averages are null', () => {
    const empty = buildDocumentModel(makeState({ status: 'ended' }), { incomplete: true });
    expect(empty.incomplete).toBe(true);
    expect(empty.checkIn.responses).toEqual([]);
    expect(empty.notes.items).toEqual([]);
    expect(empty.actions).toEqual([]);
    expect(empty.survey).toMatchObject({ answered: 0, retro: { average: null }, tool: { average: null } });
  });
});
