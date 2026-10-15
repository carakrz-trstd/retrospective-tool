import { describe, expect, it } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { escapeHtml } from '../../src/doc/escape';
import { renderHtmlDocument, renderHtmlFragment } from '../../src/doc/html';
import { SPECIAL, sampleSession } from './sample';

const model = (over = {}, incomplete = false) => buildDocumentModel(sampleSession(over), { incomplete });
const parse = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
};

describe('escapeHtml (AC-18)', () => {
  it('turns & < > " \' into entities and line breaks into <br>', () => {
    expect(escapeHtml(`<script>alert(1)</script> "q" 'a' &amp;`)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &quot;q&quot; &#39;a&#39; &amp;amp;',
    );
    expect(escapeHtml('one\ntwo\r\nthree')).toBe('one<br>two<br>three');
  });

  it('shown as text: parsing returns the original and no script element exists', () => {
    const text = `<script>alert(1)</script> "quotes" &amp; 'x'`;
    const holder = parse(`<p>${escapeHtml(text)}</p>`);
    expect(holder.querySelector('script')).toBeNull();
    expect(holder.querySelector('p')!.textContent).toBe(text);
    const multi = parse(`<p>${escapeHtml('a\nb')}</p>`);
    expect(multi.querySelector('br')).not.toBeNull();
  });
});

describe('renderHtmlFragment (AC-6, AC-8, AC-18, AC-20)', () => {
  it('has headings, lists and a table with thead and tbody for the action items', () => {
    const doc = parse(renderHtmlFragment(model()));
    expect(doc.querySelector('h1')!.textContent).toBe('Retrospective, 2026-03-01, Start-Stop-Continue');
    expect([...doc.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Participants',
      'Check-in',
      'Retrospective',
      'Discussion notes',
      'Action items',
      'Check-out',
    ]);
    expect([...doc.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(doc.querySelectorAll('ul').length).toBeGreaterThan(3);
    const table = doc.querySelector('table')!;
    expect([...table.querySelectorAll('thead th')].map((c) => c.textContent)).toEqual([
      'Action',
      'Owner(s)',
      'Due date',
    ]);
    expect([...table.querySelectorAll('tbody tr td')].map((c) => c.textContent)).toEqual([
      'write the docs',
      'Alex, Blake',
      '2026-03-15',
    ]);
  });

  it('has no class, style, script or external URL', () => {
    const html = renderHtmlFragment(model({ special: true }));
    expect(html).not.toMatch(/\sclass=|\sstyle=|<script|https?:\/\/|\ssrc=|\shref=/);
    expect(html).not.toContain('<b>x</b>');
    expect(parse(html).textContent).toContain(SPECIAL);
  });

  it('adds the incomplete note', () => {
    const doc = parse(renderHtmlFragment(model({}, true)));
    expect(doc.textContent).toContain('Incomplete: the Facilitator left before the session was ended.');
  });
});

describe('renderHtmlDocument', () => {
  it('has the doctype, lang, charset, a title equal to the heading and an embedded stylesheet', () => {
    const m = model({ title: 'Team & Co' });
    const html = renderHtmlDocument(m);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<title>Team &amp; Co</title>');
    expect(html).toMatch(/<style>[\s\S]+<\/style>/);
    expect(html).toContain(renderHtmlFragment(m));
    expect(html).not.toMatch(/<script|https?:\/\//);
  });
});
