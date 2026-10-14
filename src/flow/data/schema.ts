import { z } from 'zod';
import { issuesToMessages } from '../../formats/schema';
import { PHASES, RETRO_STEPS } from '../../formats/types';
import phasesJson from './phases.json';

const text = z.string().trim().min(1, 'must not be empty');
const share = z.number().min(0).max(1);

const entry = z.object({ oneLine: text, instruction: text, defaultShare: share });

export const phaseTextsSchema = z
  .object({
    phases: z.array(entry.extend({ id: z.enum(PHASES), title: text })).length(PHASES.length),
    retroSteps: z.array(entry.extend({ id: z.enum(RETRO_STEPS) })).length(RETRO_STEPS.length),
    guide: z.array(z.object({ title: text, text })).min(1),
  })
  .superRefine((d, ctx) => {
    d.phases.forEach((p, i) => {
      if (p.id !== PHASES[i])
        ctx.addIssue({ code: 'custom', path: ['phases', i, 'id'], message: `expected "${PHASES[i]}"` });
    });
    d.retroSteps.forEach((s, i) => {
      if (s.id !== RETRO_STEPS[i])
        ctx.addIssue({
          code: 'custom',
          path: ['retroSteps', i, 'id'],
          message: `expected "${RETRO_STEPS[i]}"`,
        });
    });
    const sum = d.phases.reduce((n, p) => n + p.defaultShare, 0);
    if (Math.abs(sum - 1) > 0.001)
      ctx.addIssue({
        code: 'custom',
        path: ['phases'],
        message: `the defaultShare values add up to ${sum}, not 1`,
      });
    const retro = d.phases.find((p) => p.id === 'retro');
    const steps = d.retroSteps.reduce((n, s) => n + s.defaultShare, 0);
    if (retro && Math.abs(retro.defaultShare - steps) > 0.001)
      ctx.addIssue({
        code: 'custom',
        path: ['retroSteps'],
        message: 'the step defaultShare values must add up to the defaultShare of the retro phase',
      });
  });

export type PhaseTexts = z.infer<typeof phaseTextsSchema>;

export function validatePhaseTexts(
  raw: unknown,
): { ok: true; value: PhaseTexts } | { ok: false; errors: string[] } {
  const r = phaseTextsSchema.safeParse(raw);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: issuesToMessages(r.error) };
}

export function buildPhaseTexts(raw: unknown): PhaseTexts {
  const r = validatePhaseTexts(raw);
  if (!r.ok) throw new Error(`Invalid data file flow/data/phases.json: ${r.errors.join('; ')}`);
  return r.value;
}

let cached: PhaseTexts | undefined;

/** The validated instruction texts and default shares (loaded once). */
export function getPhaseTexts(): PhaseTexts {
  return (cached ??= buildPhaseTexts(phasesJson));
}
