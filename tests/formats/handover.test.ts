import { describe, expect, it, vi } from 'vitest';
import { createCustomFromScratch, renameColumn } from '../../src/formats/custom';
import { defaults } from '../../src/formats/defaults';
import { startSessionCreation } from '../../src/formats/handover';
import type { ChosenFormat } from '../../src/formats/types';
import { sampleFormat } from './sample';

describe('startSessionCreation (hand-over to session creation)', () => {
  it('passes a chosen format with columns, time split, check-in question and tips', () => {
    const onStart = vi.fn();
    const chosen: ChosenFormat = { format: sampleFormat(), timeBudgetMin: 50 };
    expect(startSessionCreation(chosen, onStart)).toEqual({ ok: true });
    expect(onStart).toHaveBeenCalledTimes(1);
    const received = onStart.mock.calls[0]![0] as ChosenFormat;
    expect(received.format.columns.length).toBeGreaterThan(0);
    expect(received.format.timeSplits['50']).toBeDefined();
    expect(received.format.checkInQuestion).toBeTruthy();
    expect(received.format.facilitationTips.length).toBeGreaterThanOrEqual(2);
    expect(received.timeBudgetMin).toBe(50);
  });

  it('for a custom format the time split equals the generic default', () => {
    let custom = createCustomFromScratch();
    custom = renameColumn(custom, custom.columns[0]!.id, 'Ideas');
    custom = renameColumn(custom, custom.columns[1]!.id, 'Problems');
    const onStart = vi.fn();
    expect(startSessionCreation({ format: custom, timeBudgetMin: 30 }, onStart).ok).toBe(true);
    const received = onStart.mock.calls[0]![0] as ChosenFormat;
    expect(received.format.timeSplits['30']).toEqual(defaults.timeSplits['30']);
    expect(received.format.custom).toBe(true);
  });

  it('refuses a format that does not support its time budget', () => {
    const onStart = vi.fn();
    const only30 = sampleFormat({ timeSplits: { '30': sampleFormat().timeSplits['30']! } });
    const result = startSessionCreation({ format: only30, timeBudgetMin: 80 }, onStart);
    expect(result.ok).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('refuses an invalid format (for example an unnamed custom column)', () => {
    const onStart = vi.fn();
    const unnamed = createCustomFromScratch();
    expect(startSessionCreation({ format: unnamed, timeBudgetMin: 50 }, onStart).ok).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });
});
