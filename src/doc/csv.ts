import { csvCell } from './escape';
import type { DocumentModel } from './model';

const HEADER = 'Type,Column,Text,Author,Owner(s),Due date';

/**
 * One row per item (check-in response, retro entry, note item, action item) for the Miro import.
 * Comma separated, UTF-8 without a byte order mark, LF line endings. Check-out results are no items.
 */
export function renderCsv(model: DocumentModel): string {
  const row = (type: string, column: string, text: string, author = '', owners = '', due = '') =>
    [type, column, text, author, owners, due].map(csvCell).join(',');
  const rows: string[] = [HEADER];
  for (const r of model.checkIn.responses) rows.push(row('Check-in', 'Check-in', r.text, r.author));
  for (const c of model.retro.columns) {
    for (const e of c.entries) rows.push(row('Retro entry', c.name, e.text, e.author));
  }
  for (const n of model.notes.items) rows.push(row('Note', 'Discussion notes', n.text, n.author));
  for (const a of model.actions) {
    rows.push(row('Action item', 'Action items', a.description, '', a.owners.join(', '), a.dueDate ?? ''));
  }
  return `${rows.join('\n')}\n`;
}
