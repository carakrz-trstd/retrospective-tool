import type { ZodType } from 'zod';
import defaultsJson from './data/defaults.json';
import scoringJson from './data/scoring.json';
import {
  defaultsSchema,
  issuesToMessages,
  scoringConfigSchema,
  type Defaults,
  type ScoringConfig,
} from './schema';

function load<T>(name: string, schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new Error(`Invalid data file ${name}: ${issuesToMessages(parsed.error).join('; ')}`);
  return parsed.data;
}

/** Generic default time split (used by custom formats) and generic check-in questions. */
export const defaults: Defaults = load('data/defaults.json', defaultsSchema, defaultsJson);

/** Constants of the recommendation (goal weight, weak-match threshold, tie-break order). */
export const scoringConfig: ScoringConfig = load('data/scoring.json', scoringConfigSchema, scoringJson);
