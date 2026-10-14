// Identifiers: session ID (unguessable, in the join link), join code (short, human-friendly),
// participant token (proves "I am the same person" on rejoin) and operation IDs.

const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** No 0, O, 1, I, L: they look alike when read out or typed (FR-1.2). */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Picks `length` characters from `alphabet` without modulo bias. */
function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** 128 bits of randomness, URL-safe (letters and digits only). */
export function createSessionId(): string {
  return randomString(URL_SAFE, 24);
}

export function createToken(): string {
  return randomString(URL_SAFE, 24);
}

/**
 * A random UUID (version 4). crypto.randomUUID() only exists in secure contexts (HTTPS or
 * localhost), so this uses getRandomValues, which works everywhere (for example over plain http).
 */
export function createUuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function createOpId(): string {
  return createUuid();
}

export function createJoinCode(): string {
  return randomString(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH);
}

export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidJoinCode(input: string): boolean {
  const code = normalizeJoinCode(input);
  if (code.length !== JOIN_CODE_LENGTH) return false;
  for (const ch of code) if (!JOIN_CODE_ALPHABET.includes(ch)) return false;
  return true;
}
