import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from '../../src/doc/download';

let blobs: Blob[];
let clicks: { download: string; href: string; inDocument: boolean }[];

beforeEach(() => {
  vi.useFakeTimers();
  blobs = [];
  clicks = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blobs.push(b as Blob);
    return `blob:test/${blobs.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ download: this.download, href: this.href, inDocument: document.body.contains(this) });
  });
});
afterEach(() => vi.useRealTimers());

describe('downloadFile (AC-5, AC-8, AC-9)', () => {
  it('creates a download of the given name, MIME type and exact content through a Blob and a link', async () => {
    downloadFile('team-2026-03-01.md', 'text/markdown', '# Title\nüñ 🎉\n');
    expect(clicks).toEqual([{ download: 'team-2026-03-01.md', href: 'blob:test/1', inDocument: true }]);
    expect(blobs[0]!.type).toBe('text/markdown;charset=utf-8');
    expect(await blobs[0]!.text()).toBe('# Title\nüñ 🎉\n');
  });

  it('adds no byte order mark to a CSV file', async () => {
    downloadFile('x.csv', 'text/csv', 'Type,Column\n');
    const bytes = new Uint8Array(await blobs[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe('Type,Column\n');
  });

  it('cleans up: the link is removed at once and the URL is revoked after a short delay', () => {
    downloadFile('x.html', 'text/html', '<p>x</p>');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });
});
