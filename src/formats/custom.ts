// Custom formats: the Facilitator's own columns, made from scratch or from a library format.
// Pure editing functions: each returns a new format and never changes its input. A custom
// format exists only in memory for the session being created (nothing is stored).

import { createShortId } from '../core/ids';
import { defaults } from './defaults';
import type { Column, Format } from './schema';
import { CUSTOM_MAX_COLUMNS, validateCustomFormat, type ValidationResult } from './validate';

export type EditResult = { ok: true; format: Format } | { ok: false; reason: string };

const MIN_COLUMNS = 2;

function newColumn(name = '', prompt?: string): Column {
  return { id: `col-${createShortId(8)}`, name, ...(prompt !== undefined ? { prompt } : {}) };
}

const GENERIC_TIPS = [
  'Explain each column in one sentence before people start writing.',
  'Give everybody a quiet minute to write on their own before you reveal anything.',
];

function baseCustom(over: Partial<Format>): Format {
  return {
    id: `custom-${createShortId(10)}`,
    name: 'Custom format',
    description: 'A format with your own columns.',
    columns: [],
    timeSplits: structuredClone(defaults.timeSplits),
    fit: {
      mood: { energized: 0, neutral: 0, tired: 0, tense: 0 },
      goal: { fun: 0, bond: 0, 'reflect-period': 0, 'reflect-project': 0 },
      depth: { lean: 0, extensive: 0 },
      setting: { 'in-room': 0, remote: 0 },
    },
    checkInQuestion: defaults.checkInQuestions[0]!,
    facilitationTips: [...GENERIC_TIPS],
    custom: true,
    ...over,
  };
}

/** Two empty columns, the first generic check-in question and the generic default time splits. */
export function createCustomFromScratch(): Format {
  return baseCustom({ columns: [newColumn(), newColumn()] });
}

/** "Use as basis": a deep copy of a library format as a custom format; the original is untouched. */
export function createCustomFromLibrary(library: Format): Format {
  const source = structuredClone(library);
  return baseCustom({
    name: `${source.name} (custom)`,
    description: `Your own version of ${source.name}.`,
    columns: source.columns.map((c) => newColumn(c.name, c.prompt)),
    facilitationTips: source.facilitationTips,
    fit: source.fit,
    basedOn: { id: source.id, columnCount: source.columns.length },
  });
}

/** Adds an empty column; refused when the format already has 4 (or more) columns. */
export function addColumn(format: Format): EditResult {
  if (format.columns.length >= CUSTOM_MAX_COLUMNS) {
    return { ok: false, reason: `A custom format has at most ${CUSTOM_MAX_COLUMNS} columns.` };
  }
  return { ok: true, format: { ...format, columns: [...format.columns, newColumn()] } };
}

/** Removes a column; refused when only 2 columns are left. */
export function removeColumn(format: Format, columnId: string): EditResult {
  if (format.columns.length <= MIN_COLUMNS) {
    return { ok: false, reason: `A format needs at least ${MIN_COLUMNS} columns.` };
  }
  if (!format.columns.some((c) => c.id === columnId)) return { ok: false, reason: 'Unknown column.' };
  return { ok: true, format: { ...format, columns: format.columns.filter((c) => c.id !== columnId) } };
}

/** Moves a column one place up (-1) or down (1); at the ends nothing changes. */
export function moveColumn(format: Format, columnId: string, direction: -1 | 1): Format {
  const index = format.columns.findIndex((c) => c.id === columnId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= format.columns.length) return { ...format };
  const columns = [...format.columns];
  [columns[index], columns[target]] = [columns[target]!, columns[index]!];
  return { ...format, columns };
}

export function renameColumn(format: Format, columnId: string, name: string): Format {
  return { ...format, columns: format.columns.map((c) => (c.id === columnId ? { ...c, name } : c)) };
}

export function setPrompt(format: Format, columnId: string, prompt: string): Format {
  return {
    ...format,
    columns: format.columns.map((c) => {
      if (c.id !== columnId) return c;
      const { prompt: _old, ...rest } = c;
      return prompt === '' ? rest : { ...rest, prompt };
    }),
  };
}

/** The check-in question must be one of the generic questions. */
export function setCheckIn(format: Format, question: string): EditResult {
  if (!defaults.checkInQuestions.includes(question)) {
    return { ok: false, reason: 'Please choose one of the suggested check-in questions.' };
  }
  return { ok: true, format: { ...format, checkInQuestion: question } };
}

export function validateCustom(format: Format): ValidationResult {
  return validateCustomFormat(format);
}
