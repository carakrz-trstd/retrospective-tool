import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { renderPlainText } from '../../src/doc/text';
import { sampleSession } from './sample';

describe('renderPlainText (clipboard text part)', () => {
  const text = renderPlainText(buildDocumentModel(sampleSession(), { incomplete: false }));

  it('has the same sections', () => {
    for (const s of [
      'Retrospective, 2026-03-01, Start-Stop-Continue',
      'Participants',
      'Check-in',
      'Retrospective',
      'Discussion notes',
      'Action items',
      'Check-out',
      'Alex: sleepy but here',
      'start testing (Alex)',
      'write the docs',
    ]) {
      expect(text).toContain(s);
    }
  });

  it('has no Markdown escape characters or HTML', () => {
    expect(text).not.toMatch(/\\|<[a-z/]|^#|\*\*|\| ---/m);
  });

  it('shows the action items as readable lines', () => {
    expect(text).toContain('write the docs | Alex, Blake | 2026-03-15');
  });
});
