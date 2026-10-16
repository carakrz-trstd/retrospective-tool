import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles.css', 'utf8');

/** The custom properties of the first :root block (light) and of the dark scheme. */
function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf('* {', darkStart))) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [text colour, background, what it is]
const TEXT: [string, string, string][] = [
  ['on-surface', 'surface', 'body text'],
  ['on-surface', 'surface-low', 'text on cards'],
  ['on-surface', 'surface-container', 'text on lanes and chips'],
  ['on-surface', 'surface-high', 'text in dialogs'],
  ['on-surface', 'accent-container', 'text on the recommended format'],
  ['on-surface-variant', 'surface', 'hints'],
  ['on-surface-variant', 'surface-low', 'hints on cards'],
  ['on-surface-variant', 'surface-container', 'hints on lanes'],
  ['on-surface-variant', 'surface-high', 'hints in dialogs'],
  ['primary', 'surface', 'outlined buttons and links'],
  ['primary', 'surface-low', 'buttons on cards'],
  ['primary', 'surface-container', 'buttons on lanes'],
  ['on-primary', 'primary', 'filled buttons'],
  ['on-primary-container', 'primary-container', 'chips'],
  ['on-secondary-container', 'secondary-container', 'selected options and current step'],
  ['on-accent', 'accent', 'badges and the current step marker'],
  ['on-warn-container', 'warn-container', 'warnings'],
  ['on-error-container', 'error-container', 'errors and overtime'],
  ['error', 'surface', 'error text'],
  ['error', 'surface-low', 'error text on cards'],
  ['ok', 'surface', 'online marker'],
  ['on-app-bar', 'app-bar', 'app bar'],
];

// [colour, background, what it is]: graphics and component borders need 3:1
const GRAPHICS: [string, string, string][] = [
  ['outline', 'surface', 'field and button borders'],
  ['outline', 'surface-low', 'field borders on cards'],
  ['outline', 'surface-container', 'field borders on lanes'],
  ['primary', 'surface', 'focus ring'],
  ['primary', 'surface-low', 'focus ring on cards'],
  ['accent-strong', 'surface', 'timer ring when time runs low'],
  ['accent-strong', 'surface-low', 'timer ring on its card'],
  ['error', 'surface-low', 'timer ring in overtime'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('colour contrast, %s scheme (WCAG AA)', (_scheme, t) => {
  it.each(TEXT)('%s on %s is at least 4.5:1 (%s)', (fg, bg) => {
    expect(t[fg], `--${fg} is defined`).toBeTruthy();
    expect(t[bg], `--${bg} is defined`).toBeTruthy();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHICS)('%s on %s is at least 3:1 (%s)', (fg, bg) => {
    expect(t[fg], `--${fg} is defined`).toBeTruthy();
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe('motion and focus', () => {
  it('all durations are between 150 and 250 ms (one token each) and nothing else is hard-coded', () => {
    const ms = [...css.matchAll(/--motion-[a-z]+:\s*(\d+)ms/g)].map((m) => Number(m[1]));
    expect(ms.length).toBeGreaterThanOrEqual(2);
    for (const v of ms) {
      expect(v).toBeGreaterThanOrEqual(150);
      expect(v).toBeLessThanOrEqual(250);
    }
    // the timer ring moves continuously with the clock and is the only longer, linear transition
    const raw = [...css.matchAll(/(?:transition|animation)[a-z-]*:[^;{}]*?([\d.]+)ms/g)].map((m) =>
      Number(m[1]),
    );
    for (const v of raw) expect(v === 300 || v === 0.01 || (v >= 150 && v <= 250)).toBe(true);
  });

  it('respects prefers-reduced-motion by switching animations and transitions off', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
    expect(block).toMatch(/scroll-behavior:\s*auto/);
  });

  it('new entries, notes and action items fade in', () => {
    expect(css).toMatch(/\.entry-card\s*\{[^}]*animation:\s*entry-in/);
    expect(css).toMatch(/@keyframes entry-in/);
  });

  it('every interactive element gets a solid focus ring', () => {
    const rule = css.match(/:focus-visible\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toMatch(/outline:\s*3px solid var\(--primary\)/);
  });
});
