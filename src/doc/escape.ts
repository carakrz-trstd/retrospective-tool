// Escaping of participant text for each export format. Each renderer escapes once, for its own format.

function escapeMarkdownLine(line: string): string {
  let out = line.replace(/[\\`*_[\]<>|~&]/g, '\\$&');
  // a line that starts like a heading, list item, ordered list or setext underline
  out = out.replace(/^(\s*)([#+\-=])/, '$1\\$2');
  out = out.replace(/^(\s*\d+)([.)])/, '$1\\$2');
  return out;
}

/** Markdown: the text always shows as text; line breaks become <br> so cells and list items stay on one line. */
export function escapeMarkdown(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(escapeMarkdownLine).join('<br>');
}

/** HTML: & < > " ' as entities, line breaks as <br>. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n?|\n/g, '<br>');
}

/** Text exactly as it is, for the plain-text part of the clipboard. */
export function escapePlain(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * CSV: a quoted cell with doubled inner quotes. A cell that a spreadsheet could run as a formula
 * (it starts with = + - @, a tab or a carriage return) gets a single quote in front of it.
 */
export function csvCell(text: string): string {
  if (text === '') return '';
  const protectedText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/\r\n?/g, '\n').replace(/"/g, '""')}"`;
}
