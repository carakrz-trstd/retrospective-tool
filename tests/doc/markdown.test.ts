import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { renderMarkdown } from '../../src/doc/markdown';
import { makeState } from '../contrib/stateBuilder';
import { SPECIAL, sampleSession } from './sample';

const model = (over = {}) => buildDocumentModel(sampleSession(over), { incomplete: false });

describe('renderMarkdown (AC-5, AC-18, AC-20)', () => {
  it('matches the expected document for the sample model', () => {
    expect(renderMarkdown(model({ title: 'Team Alpha' }))).toBe(
      [
        '# Team Alpha',
        '',
        '2026-03-01 · Format: Start-Stop-Continue · 50 minutes',
        '',
        '## Participants',
        '',
        '- Fiona (Scrum Master), Facilitator',
        '- Alex (Developer)',
        '- Blake (Tester)',
        '',
        '## Check-in',
        '',
        'Question: How are you arriving today?',
        '',
        '- Alex: sleepy but here',
        '- Blake: fine',
        '',
        '## Retrospective',
        '',
        '### Alpha',
        '',
        '*What is alpha?*',
        '',
        '- start testing (Alex)',
        '',
        '### Beta',
        '',
        '- stop meetings (Blake)',
        '',
        '### Gamma',
        '',
        '*No entries.*',
        '',
        '## Discussion notes',
        '',
        'Note taker: Blake',
        '',
        '- we agreed on X (Alex)',
        '',
        '## Action items',
        '',
        '| Action | Owner(s) | Due date |',
        '| --- | --- | --- |',
        '| write the docs | Alex, Blake | 2026-03-15 |',
        '',
        '## Check-out',
        '',
        'Answers: 2',
        '',
        'Retrospective: average 4.5 · ratings 1 to 5: 0 / 0 / 0 / 1 / 1',
        '',
        '- great retro',
        '',
        'Tool: average 3.5 · ratings 1 to 5: 0 / 0 / 1 / 1 / 0',
        '',
        '- slow on my phone',
        '',
      ].join('\n'),
    );
  });

  it('shows action items as a table Action | Owner(s) | Due date, with ", " between owners and "–" for no date', () => {
    const state = sampleSession();
    const withoutDate = makeStateWithAction(state);
    const md = renderMarkdown(buildDocumentModel(withoutDate, { incomplete: false }));
    expect(md).toContain('| Action | Owner(s) | Due date |');
    expect(md).toContain('| write the docs | Alex, Blake | 2026-03-15 |');
    expect(md).toContain('| no date action | Alex | – |');
  });

  it('has the heading and the participants list', () => {
    const md = renderMarkdown(model());
    expect(md.startsWith('# Retrospective, 2026-03-01, Start-Stop-Continue\n')).toBe(true);
    expect(md).toContain('## Participants');
  });

  it('adds the incomplete note at the top', () => {
    const md = renderMarkdown(buildDocumentModel(sampleSession(), { incomplete: true }));
    const lines = md.split('\n');
    expect(lines[0]).toBe('# Retrospective, 2026-03-01, Start-Stop-Continue');
    expect(lines[2]).toBe('> Incomplete: the Facilitator left before the session was ended.');
  });

  it('entries with special characters do not break headings, lists or the table', () => {
    const md = renderMarkdown(model({ special: true }));
    expect(md).toContain('- \\*bold\\* \\<b\\>x\\</b\\> =SUM(A1), "quoted" \\& more (Alex)');
    const lines = md.split('\n');
    // no line other than our own headings starts with a heading mark, and the table has 3 cells per row
    expect(lines.filter((l) => l.startsWith('#')).every((l) => /^#{1,3} /.test(l))).toBe(true);
    for (const l of lines.filter((l) => l.startsWith('|'))) expect(l.split(/(?<!\\)\|/).length).toBe(5);
    expect(SPECIAL).toContain('*bold*');
  });

  it('an empty model renders without errors and without empty tables', () => {
    const md = renderMarkdown(buildDocumentModel(makeState({ status: 'ended' }), { incomplete: false }));
    expect(md).toContain('# Retrospective,');
    expect(md).not.toContain('| Action |');
    expect(md).toContain('*No action items.*');
    expect(md).toContain('Retrospective: average – ');
  });
});

function makeStateWithAction(state: ReturnType<typeof sampleSession>) {
  const contrib = state.extensions.contrib as { actions: Record<string, unknown> };
  const now = 5_000;
  return {
    ...state,
    extensions: {
      ...state.extensions,
      contrib: {
        ...contrib,
        actions: {
          ...contrib.actions,
          'x-2': {
            id: 'x-2',
            description: 'no date action',
            owners: [{ participantId: 'p-alex', name: 'Alex' }],
            createdBy: 'p-alex',
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    },
  };
}
