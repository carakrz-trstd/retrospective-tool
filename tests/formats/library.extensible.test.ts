import { describe, expect, it } from 'vitest';
import { buildLibrary } from '../../src/formats/library';
import { recommend } from '../../src/formats/scoring';
import scoringJson from '../../src/formats/data/scoring.json';
import { scoringConfigSchema } from '../../src/formats/schema';
import { sampleFormat } from './sample';

const modules = import.meta.glob('../../src/formats/data/library/*.json', { eager: true, import: 'default' });

describe('adding a format needs only a new data file (AC-16)', () => {
  const config = scoringConfigSchema.parse(scoringJson);

  it('an extra valid file appears in listFormats and takes part in a recommendation without code changes', () => {
    const extra = sampleFormat({
      id: 'extra-format',
      name: 'Extra Format',
      fit: {
        mood: { energized: 3, neutral: 3, tired: 3, tense: 3 },
        goal: { fun: 3, bond: 3, 'reflect-period': 3, 'reflect-project': 3 },
        depth: { lean: 3, extensive: 3 },
        setting: { 'in-room': 3, remote: 3 },
      },
    });
    const lib = buildLibrary(
      { ...modules, '../../src/formats/data/library/extra-format.json': extra },
      config.order,
    );
    expect(lib.map((f) => f.id)).toContain('extra-format');
    const rec = recommend(
      { mood: 'tired', goal: 'fun', timeBudgetMin: 30, depth: 'lean', setting: 'remote' },
      lib,
      config,
    );
    expect(rec.recommended.format.id).toBe('extra-format'); // perfect weights everywhere
  });

  it('an invalid extra file makes loading fail with an error naming the file', () => {
    const broken = sampleFormat({ id: 'broken-format' }) as unknown as Record<string, unknown>;
    delete broken.name;
    expect(() =>
      buildLibrary({ ...modules, '../../src/formats/data/library/broken-format.json': broken }, config.order),
    ).toThrow(/broken-format\.json/);
  });

  it('two files with the same ID are refused', () => {
    const copy = sampleFormat({ id: 'start-stop-continue' });
    expect(() =>
      buildLibrary({ ...modules, '../../src/formats/data/library/copy.json': copy }, config.order),
    ).toThrow(/start-stop-continue/);
  });
});
