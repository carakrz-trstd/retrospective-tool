import { toBlocks, type Block } from './blocks';
import { escapeHtml } from './escape';
import type { DocumentModel } from './model';

function block(b: Block): string {
  switch (b.t) {
    case 'h1':
    case 'h2':
    case 'h3':
      return `<${b.t}>${escapeHtml(b.text)}</${b.t}>`;
    case 'p':
    case 'note':
      return `<p>${escapeHtml(b.text)}</p>`;
    case 'em':
      return `<p><em>${escapeHtml(b.text)}</em></p>`;
    case 'ul':
      return `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    case 'table':
      return (
        `<table><thead><tr>${b.head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>` +
        `<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      );
  }
}

/** Semantic HTML without classes, scripts or external resources (it is pasted into Confluence). */
export function renderHtmlFragment(model: DocumentModel): string {
  return toBlocks(model).map(block).join('');
}

const STYLE =
  'body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.5}' +
  'table{border-collapse:collapse}th,td{border:1px solid #bbb;padding:.3rem .6rem;text-align:left}';

/** A complete page for the HTML download. */
export function renderHtmlDocument(model: DocumentModel): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(model.heading)}</title>` +
    `<style>${STYLE}</style></head><body>${renderHtmlFragment(model)}</body></html>`
  );
}
