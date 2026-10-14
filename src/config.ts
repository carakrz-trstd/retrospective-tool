// Runtime configuration. Values come from Vite env values (VITE_*) with defaults for the
// public PeerJS broker and a public STUN server. Broker and STUN servers are replaceable
// settings (PRD NFR-10, NFR-11): nothing else in the code knows their addresses.

export interface BrokerConfig {
  host: string;
  port: number;
  path: string;
  key: string;
  secure: boolean;
}

export interface AppConfig {
  broker: BrokerConfig;
  stunUrls: string[];
  /** Facilitator offline for this long: participants see the "copy your entries" hint (FR-1.15). */
  hostOfflineHintMs: number;
  /** Local records not written for this long are removed (FR-1.9). */
  expiryMs: number;
  /** Maximum number of join-code lookups the host answers per minute. */
  maxLookupsPerMinute: number;
}

type Env = Record<string, string | undefined>;

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

function positiveInt(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid value for ${name}: "${raw}" (expected a positive whole number)`);
  }
  return value;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Invalid value for ${name}: "${raw}" (expected true or false)`);
}

export function loadConfig(env: Env): AppConfig {
  const stunRaw = env.VITE_STUN_URLS;
  const stunUrls =
    stunRaw === undefined
      ? [DEFAULT_STUN]
      : stunRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

  return {
    broker: {
      host: env.VITE_PEER_HOST || '0.peerjs.com',
      port: positiveInt(env, 'VITE_PEER_PORT', 443),
      path: env.VITE_PEER_PATH || '/',
      key: env.VITE_PEER_KEY || 'peerjs',
      secure: bool(env, 'VITE_PEER_SECURE', true),
    },
    stunUrls,
    hostOfflineHintMs: positiveInt(env, 'VITE_HOST_OFFLINE_HINT_MS', 15 * 60 * 1000),
    expiryMs: positiveInt(env, 'VITE_EXPIRY_MS', 24 * 60 * 60 * 1000),
    maxLookupsPerMinute: positiveInt(env, 'VITE_MAX_LOOKUPS_PER_MINUTE', 10),
  };
}

export const config: AppConfig = loadConfig(import.meta.env as unknown as Env);
