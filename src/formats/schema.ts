// The one shared definition of a format (library files and custom formats), plus the schemas of
// the other data files. TypeScript types are derived from these schemas.

import { z } from 'zod';
import { DEPTHS, GOALS, MOODS, SETTINGS, TIME_BUDGETS } from './types';

const text = z.string().trim().min(1, 'must not be empty');
const minutes = z.number().int('must be a whole number').min(0, 'must not be negative');
const weight = z
  .number()
  .int('must be a whole number')
  .min(0, 'must be between 0 and 3')
  .max(3, 'must be between 0 and 3');

export const columnSchema = z.object({
  id: text,
  name: text,
  prompt: z.string().optional(),
});

export const timeSplitSchema = z.object({
  checkIn: minutes,
  reviewActions: minutes,
  retro: z.object({ write: minutes, reveal: minutes, discuss: minutes }),
  notes: minutes,
  actions: minutes,
  checkOut: minutes,
});

export function splitTotal(s: z.infer<typeof timeSplitSchema>): number {
  return (
    s.checkIn +
    s.reviewActions +
    s.retro.write +
    s.retro.reveal +
    s.retro.discuss +
    s.notes +
    s.actions +
    s.checkOut
  );
}

const budgetKeys = TIME_BUDGETS.map(String) as ['30', '50', '80'];

export const formatSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lower case letters, digits and hyphens'),
    name: text,
    description: text,
    source: z.object({ name: text, url: z.string().url() }).optional(),
    columns: z.array(columnSchema).min(2, 'needs at least 2 columns').max(5, 'allows at most 5 columns'),
    timeSplits: z.object({
      '30': timeSplitSchema.optional(),
      '50': timeSplitSchema.optional(),
      '80': timeSplitSchema.optional(),
    }),
    fit: z.object({
      mood: z.object({ energized: weight, neutral: weight, tired: weight, tense: weight }),
      goal: z.object({ fun: weight, bond: weight, 'reflect-period': weight, 'reflect-project': weight }),
      depth: z.object({ lean: weight, extensive: weight }),
      setting: z.object({ 'in-room': weight, remote: weight }),
    }),
    reasons: z
      .object({
        mood: z.partialRecord(z.enum(MOODS), text).optional(),
        goal: z.partialRecord(z.enum(GOALS), text).optional(),
      })
      .optional(),
    checkInQuestion: text,
    facilitationTips: z.array(text).min(2, 'needs at least 2 tips'),
    custom: z.literal(true).optional(),
    /** Set on a custom format that was copied from a library format ("Use as basis"). */
    basedOn: z.object({ id: text, columnCount: z.number().int().min(1) }).optional(),
  })
  .superRefine((f, ctx) => {
    const ids = new Set<string>();
    f.columns.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['columns', i, 'id'], message: 'column IDs must be unique' });
      ids.add(c.id);
    });
    const present = budgetKeys.filter((k) => f.timeSplits[k] !== undefined);
    if (present.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeSplits'],
        message: 'needs a time split for at least one duration',
      });
    }
    for (const k of present) {
      const split = f.timeSplits[k]!;
      if (splitTotal(split) !== Number(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeSplits', k],
          message: `the minutes add up to ${splitTotal(split)}, not ${k}`,
        });
      }
    }
  });

export type Format = z.infer<typeof formatSchema>;
export type Column = z.infer<typeof columnSchema>;
export type TimeSplit = z.infer<typeof timeSplitSchema>;

/** Constants of the scorer (data/scoring.json). */
export const scoringConfigSchema = z.object({
  goalMultiplier: z.number().min(0, 'must not be negative'),
  weakThreshold: z.number().min(0, 'must be between 0 and 1').max(1, 'must be between 0 and 1'),
  maxAlternatives: z.number().int().min(1).max(2),
  order: z.array(z.string()),
});
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

/** Generic defaults (data/defaults.json): the split used by custom formats and the generic check-in questions. */
export const defaultsSchema = z
  .object({
    timeSplits: z.object({ '30': timeSplitSchema, '50': timeSplitSchema, '80': timeSplitSchema }),
    checkInQuestions: z.array(text).min(5, 'needs at least 5 questions'),
  })
  .superRefine((d, ctx) => {
    for (const k of budgetKeys) {
      if (splitTotal(d.timeSplits[k]) !== Number(k)) {
        ctx.addIssue({
          code: 'custom',
          path: ['timeSplits', k],
          message: `the minutes do not add up to ${k}`,
        });
      }
    }
    if (new Set(d.checkInQuestions).size !== d.checkInQuestions.length) {
      ctx.addIssue({ code: 'custom', path: ['checkInQuestions'], message: 'questions must be unique' });
    }
  });
export type Defaults = z.infer<typeof defaultsSchema>;

export function issuesToMessages(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.join('.');
    return path ? `${path}: ${i.message}` : i.message;
  });
}
