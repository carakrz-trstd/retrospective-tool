import { describe, expect, it } from 'vitest';
import { getPhaseTexts, phaseTextsSchema, validatePhaseTexts } from '../../src/flow/data/schema';
import phasesJson from '../../src/flow/data/phases.json';
import { PHASES, RETRO_STEPS } from '../../src/formats/types';

describe('phases.json', () => {
  const texts = getPhaseTexts();

  it('passes the schema', () => {
    expect(phaseTextsSchema.safeParse(phasesJson).success).toBe(true);
  });

  it('has the six phases in the order of PHASES and the three retro steps in the order of RETRO_STEPS', () => {
    expect(texts.phases.map((p) => p.id)).toEqual([...PHASES]);
    expect(texts.retroSteps.map((s) => s.id)).toEqual([...RETRO_STEPS]);
  });

  it('every phase and step has a one-line text and an instruction', () => {
    for (const p of [...texts.phases, ...texts.retroSteps]) {
      expect(p.oneLine.trim().length, p.id).toBeGreaterThan(10);
      expect(p.instruction.trim().length, p.id).toBeGreaterThan(20);
    }
  });

  it("the default shares sum to 1.0 and the retro phase's share equals the sum of its three steps", () => {
    const sum = texts.phases.reduce((n, p) => n + p.defaultShare, 0);
    expect(sum).toBeCloseTo(1, 5);
    const retro = texts.phases.find((p) => p.id === 'retro')!;
    const steps = texts.retroSteps.reduce((n, s) => n + s.defaultShare, 0);
    expect(retro.defaultShare).toBeCloseTo(steps, 5);
  });

  it('the review phase tells people to open the documentation of the last retro and that nothing is stored or imported', () => {
    const review = texts.phases.find((p) => p.id === 'reviewActions')!;
    const text = `${review.oneLine} ${review.instruction}`;
    expect(text).toMatch(/documentation from your last retro/i);
    expect(text).toMatch(/Confluence/);
    expect(text).toMatch(/does not store or import/i);
  });

  it('the guide says that the Facilitator role cannot be handed over', () => {
    const guide = texts.guide.map((g) => `${g.title} ${g.text}`).join(' ');
    expect(guide).toMatch(/cannot be handed/i);
    expect(guide).toMatch(/Resume session/);
  });

  it('a file with a missing field fails with a message naming the field', () => {
    const broken = structuredClone(phasesJson) as Record<string, any>;
    delete broken.phases[2].instruction;
    const r = validatePhaseTexts(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/phases\.2\.instruction/);
  });

  it('a share sum of 0.9 fails with a message', () => {
    const broken = structuredClone(phasesJson) as Record<string, any>;
    broken.phases[0].defaultShare = 0;
    const r = validatePhaseTexts(broken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/defaultShare|share/);
  });

  it('phases in the wrong order fail', () => {
    const broken = structuredClone(phasesJson) as Record<string, any>;
    [broken.phases[0], broken.phases[1]] = [broken.phases[1], broken.phases[0]];
    expect(validatePhaseTexts(broken).ok).toBe(false);
  });
});
