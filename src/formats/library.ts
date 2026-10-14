// The built-in format library: every JSON file in data/library is one format. Adding a format
// means adding a file there; the files are bundled at build time and checked on load.

import { formatSchema, issuesToMessages, type Format } from './schema';
import { scoringConfig } from './defaults';
import type { TimeBudget } from './types';

/**
 * Validates the files and returns the formats in tie-break order (formats that are not in
 * `order` come last, sorted by ID). A broken file fails with an error that names the file.
 */
export function buildLibrary(files: Record<string, unknown>, order: string[]): Format[] {
  const formats: Format[] = [];
  const seen = new Map<string, string>();
  for (const [path, raw] of Object.entries(files)) {
    const parsed = formatSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid format file ${path}: ${issuesToMessages(parsed.error).join('; ')}`);
    }
    const format = parsed.data;
    const other = seen.get(format.id);
    if (other) throw new Error(`Format ID "${format.id}" is used by two files: ${other} and ${path}`);
    seen.set(format.id, path);
    formats.push(format);
  }
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return formats.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

const files = import.meta.glob('./data/library/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

const library: Format[] = buildLibrary(files, scoringConfig.order);

export function listFormats(): Format[] {
  return library;
}

export function getFormat(id: string): Format | undefined {
  return library.find((f) => f.id === id);
}

/** Does the format have a time split for this total time? */
export function supports(format: Format, budget: TimeBudget): boolean {
  return format.timeSplits[String(budget) as '30' | '50' | '80'] !== undefined;
}

/** The time split of a format for a total time (undefined when the format does not support it). */
export function timeSplitFor(format: Format, budget: TimeBudget) {
  return format.timeSplits[String(budget) as '30' | '50' | '80'];
}

/** Durations a format supports, ascending. */
export function supportedBudgets(format: Format): TimeBudget[] {
  return ([30, 50, 80] as const).filter((b) => supports(format, b));
}
