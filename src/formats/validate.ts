// Validation of formats: one structural check for every format (library file or custom) and the
// extra rules that only apply to custom formats.

import { formatSchema, issuesToMessages, type Format } from './schema';

export type ValidationResult = { ok: true; format: Format } | { ok: false; errors: string[] };

export const CUSTOM_MAX_COLUMNS = 4;
export const COLUMN_NAME_MAX = 30;
export const PROMPT_MAX = 120;

/** Checks the structure of a format (fields, columns, time splits, weights, tips). */
export function validateFormat(input: unknown): ValidationResult {
  const parsed = formatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesToMessages(parsed.error) };
  return { ok: true, format: parsed.data };
}

/**
 * Everything validateFormat checks, plus the rules for custom formats: 2 to 4 columns (a copy of
 * a library format may keep the columns it had), names up to 30 characters and different from each
 * other (ignoring upper/lower case), prompts up to 120 characters.
 */
export function validateCustomFormat(input: unknown): ValidationResult {
  const base = validateFormat(input);
  if (!base.ok) return base;
  const f = base.format;
  const errors: string[] = [];

  const maxColumns = Math.max(CUSTOM_MAX_COLUMNS, f.basedOn?.columnCount ?? 0);
  if (f.columns.length > maxColumns) {
    errors.push(`columns: a custom format has at most ${maxColumns} columns`);
  }

  const seen = new Map<string, number>();
  f.columns.forEach((c, i) => {
    const name = c.name.trim();
    if (name.length > COLUMN_NAME_MAX) {
      errors.push(`columns.${i}.name: at most ${COLUMN_NAME_MAX} characters`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) errors.push(`columns.${i}.name: column names must be different from each other`);
    seen.set(key, i);
    if ((c.prompt ?? '').length > PROMPT_MAX) {
      errors.push(`columns.${i}.prompt: at most ${PROMPT_MAX} characters`);
    }
  });

  return errors.length ? { ok: false, errors } : { ok: true, format: f };
}
