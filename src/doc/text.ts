import { toBlocks, type Block } from './blocks';
import { escapePlain } from './escape';
import type { DocumentModel } from './model';

function block(b: Block): string {
  switch (b.t) {
    case 'ul':
      return b.items.map((i) => `- ${escapePlain(i)}`).join('\n');
    case 'table':
      return [b.head.join(' | '), ...b.rows.map((r) => r.map(escapePlain).join(' | '))].join('\n');
    default:
      return escapePlain(b.text);
  }
}

/** The plain-text part of the clipboard: the same content as the Markdown, without escape marks. */
export function renderPlainText(model: DocumentModel): string {
  return `${toBlocks(model).map(block).join('\n\n')}\n`;
}
