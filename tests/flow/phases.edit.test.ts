import { describe, expect, it } from 'vitest';
import { buildPhaseTexts } from '../../src/flow/data/schema';
import phasesJson from '../../src/flow/data/phases.json';

describe('editing the instruction texts (AC-21)', () => {
  it('changing an instruction in a copy of the data file changes the loaded text without any code change', () => {
    const copy = structuredClone(phasesJson) as typeof phasesJson;
    copy.phases[0]!.instruction = 'A brand new instruction for the check-in that is long enough.';
    const loaded = buildPhaseTexts(copy);
    expect(loaded.phases[0]!.instruction).toBe(
      'A brand new instruction for the check-in that is long enough.',
    );
    // the shipped data is untouched
    expect(buildPhaseTexts(phasesJson).phases[0]!.instruction).not.toBe(loaded.phases[0]!.instruction);
  });

  it('an invalid edit is refused with an error that names the problem', () => {
    const copy = structuredClone(phasesJson) as typeof phasesJson;
    copy.phases[0]!.oneLine = '';
    expect(() => buildPhaseTexts(copy)).toThrow(/phases\.0\.oneLine/);
  });
});
