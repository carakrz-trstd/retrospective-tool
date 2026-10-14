// The hand-over of the chosen format and time budget to session creation (FR-2.6).

import { supports } from './library';
import type { ChosenFormat } from './types';
import { validateCustomFormat, validateFormat } from './validate';

export type HandoverResult = { ok: true } | { ok: false; reason: string };

/**
 * Checks the choice (a valid format that supports the chosen time) and passes it on. A custom
 * format is checked with the custom rules, a library format with the structural rules.
 */
export function startSessionCreation(
  chosen: ChosenFormat,
  onStart: (chosen: ChosenFormat) => void,
): HandoverResult {
  const validation = chosen.format.custom
    ? validateCustomFormat(chosen.format)
    : validateFormat(chosen.format);
  if (!validation.ok) return { ok: false, reason: validation.errors.join('; ') };
  if (!supports(chosen.format, chosen.timeBudgetMin)) {
    return { ok: false, reason: `${chosen.format.name} does not support ${chosen.timeBudgetMin} minutes.` };
  }
  onStart(chosen);
  return { ok: true };
}
