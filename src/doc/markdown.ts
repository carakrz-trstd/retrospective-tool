import { toBlocks, type Block } from './blocks';
import { escapeMarkdown } from './escape';
import type { DocumentModel } from './model';

function block(b: Block): string {
  switch (b.t) {
    case 'h1':
      return `# ${escapeMarkdown(b.text)}`;
    case 'h2':
      return `## ${escapeMarkdown(b.text)}`;
    case 'h3':
      return `### ${escapeMarkdown(b.text)}`;
    case 'note':
      return `> ${escapeMarkdown(b.text)}`;
    case 'p':
      return escapeMarkdown(b.text);
    case 'em':
      return `*${escapeMarkdown(b.text)}*`;
    case 'ul':
      return b.items.map((i) => `- ${escapeMarkdown(i)}`).join('\n');
    case 'table':
      return [
        `| ${b.head.map(escapeMarkdown).join(' | ')} |`,
        `| ${b.head.map(() => '---').join(' | ')} |`,
        ...b.rows.map((r) => `| ${r.map(escapeMarkdown).join(' | ')} |`),
      ].join('\n');
  }
}

/** GitHub-flavored Markdown of the documentation. */
export function renderMarkdown(model: DocumentModel): string {
  return `${toBlocks(model).map(block).join('\n\n')}\n`;
}
