import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('config', () => {
  it('returns defaults for the public PeerJS broker and a public STUN server', () => {
    const c = loadConfig({});
    expect(c.broker).toEqual({ host: '0.peerjs.com', port: 443, path: '/', key: 'peerjs', secure: true });
    expect(c.stunUrls.length).toBeGreaterThan(0);
    expect(c.hostOfflineHintMs).toBe(15 * 60 * 1000);
    expect(c.expiryMs).toBe(24 * 60 * 60 * 1000);
    expect(c.maxLookupsPerMinute).toBe(10);
  });

  it('overrides broker and STUN values from Vite env values', () => {
    const c = loadConfig({
      VITE_PEER_HOST: 'localhost',
      VITE_PEER_PORT: '9000',
      VITE_PEER_PATH: '/signal',
      VITE_PEER_KEY: 'k',
      VITE_PEER_SECURE: 'false',
      VITE_STUN_URLS: '',
    });
    expect(c.broker).toEqual({ host: 'localhost', port: 9000, path: '/signal', key: 'k', secure: false });
    expect(c.stunUrls).toEqual([]);
  });

  it('splits several STUN urls', () => {
    const c = loadConfig({ VITE_STUN_URLS: 'stun:a.example:3478, stun:b.example:3478' });
    expect(c.stunUrls).toEqual(['stun:a.example:3478', 'stun:b.example:3478']);
  });

  it('overrides timing values and rejects an invalid one', () => {
    expect(loadConfig({ VITE_HOST_OFFLINE_HINT_MS: '5000' }).hostOfflineHintMs).toBe(5000);
    expect(() => loadConfig({ VITE_HOST_OFFLINE_HINT_MS: 'soon' })).toThrow(/VITE_HOST_OFFLINE_HINT_MS/);
    expect(() => loadConfig({ VITE_EXPIRY_MS: '-1' })).toThrow(/VITE_EXPIRY_MS/);
    expect(() => loadConfig({ VITE_PEER_PORT: '0' })).toThrow(/VITE_PEER_PORT/);
  });
});
