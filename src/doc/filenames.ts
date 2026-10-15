import type { DocumentModel } from './model';

const MAX_SLUG = 60;

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
}

/** `<slug of the title or format name>-<date>`. */
export function fileBase(model: DocumentModel): string {
  const name = slug(model.title ?? '') || slug(model.format.name) || 'retrospective';
  return `${name}-${model.date}`;
}

const EXTENSIONS = { markdown: 'md', html: 'html', csv: 'csv' } as const;

export function fileName(model: DocumentModel, kind: keyof typeof EXTENSIONS): string {
  return `${fileBase(model)}.${EXTENSIONS[kind]}`;
}
