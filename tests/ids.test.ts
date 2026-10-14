import { describe, expect, it } from 'vitest';
import {
  JOIN_CODE_ALPHABET,
  createJoinCode,
  createOpId,
  createSessionId,
  createToken,
  createUuid,
  isValidJoinCode,
  normalizeJoinCode,
} from '../src/core/ids';

describe('ids', () => {
  it('createSessionId returns URL-safe strings of at least 22 characters, different every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = createSessionId();
      expect(id).toMatch(/^[A-Za-z0-9]{22,}$/);
      seen.add(id);
    }
    expect(seen.size).toBe(1000);
  });

  it('createJoinCode returns 6 characters from the alphabet, never 0 O 1 I L', () => {
    for (let i = 0; i < 1000; i++) {
      const code = createJoinCode();
      expect(code).toHaveLength(6);
      for (const ch of code) {
        expect(JOIN_CODE_ALPHABET).toContain(ch);
        expect('0O1IL').not.toContain(ch);
      }
    }
  });

  it('the alphabet has no look-alike characters', () => {
    for (const bad of '0O1IL') expect(JOIN_CODE_ALPHABET).not.toContain(bad);
  });

  it('normalizeJoinCode trims and upper-cases', () => {
    expect(normalizeJoinCode(' k7m4qx ')).toBe('K7M4QX');
  });

  it('codes containing look-alike characters or the wrong length are invalid', () => {
    expect(isValidJoinCode('K7M4QX')).toBe(true);
    expect(isValidJoinCode(' k7m4qx ')).toBe(true);
    expect(isValidJoinCode('K7M4Q0')).toBe(false);
    expect(isValidJoinCode('K7M4QO')).toBe(false);
    expect(isValidJoinCode('K7M4Q1')).toBe(false);
    expect(isValidJoinCode('K7M4QI')).toBe(false);
    expect(isValidJoinCode('K7M4QL')).toBe(false);
    expect(isValidJoinCode('K7M4Q')).toBe(false);
    expect(isValidJoinCode('K7M4QXX')).toBe(false);
    expect(isValidJoinCode('')).toBe(false);
  });

  it('works without crypto.randomUUID (missing outside secure contexts, e.g. plain http)', async () => {
    const original = crypto.randomUUID;
    // @ts-expect-error simulate an insecure context
    crypto.randomUUID = undefined;
    try {
      const uuid = createUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(createOpId()).not.toBe(createOpId());
      // the whole create-session path must not need randomUUID
      const { createSession, join } = await import('../src/core/reducer');
      const { testFormat } = await import('./helpers');
      const created = createSession(
        { name: 'F', role: 'R', format: testFormat, timeBudgetMin: 50, sessionId: 'S', joinCode: 'K7M4QX' },
        { now: 1 },
      );
      expect(join(created.data, { name: 'A', role: 'B' }, { now: 2 }).ok).toBe(true);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('createToken and createOpId are unique over 1000 calls', () => {
    const tokens = new Set<string>();
    const ops = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(createToken());
      ops.add(createOpId());
    }
    expect(tokens.size).toBe(1000);
    expect(ops.size).toBe(1000);
    expect(createToken()).toMatch(/^[A-Za-z0-9]{22,}$/);
  });
});
