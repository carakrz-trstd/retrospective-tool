import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { joinLink } from '../src/app/router';

const outDir = mkdtempSync(join(tmpdir(), 'retro-build-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('build', () => {
  it('the built index.html references its assets with relative paths (works under a GitHub Pages sub-path)', async () => {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    const assets = refs.filter((r) => r.includes('assets/'));
    expect(assets.length).toBeGreaterThan(0);
    for (const ref of assets) {
      expect(ref.startsWith('./assets/')).toBe(true);
    }
    expect(refs.some((r) => r.startsWith('/'))).toBe(false);
  }, 60_000);

  it('the join link is <origin><base>#/join/<id> for a sub-path base', () => {
    expect(joinLink('https://team.github.io/retro-tool/', 'abc123')).toBe(
      'https://team.github.io/retro-tool/#/join/abc123',
    );
    expect(joinLink('https://team.github.io/retro-tool/index.html#/session', 'abc123')).toBe(
      'https://team.github.io/retro-tool/index.html#/join/abc123',
    );
  });
});
