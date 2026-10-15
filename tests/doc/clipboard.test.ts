import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDocumentModel } from '../../src/doc/build';
import { copyRichText } from '../../src/doc/clipboard';
import { renderHtmlFragment } from '../../src/doc/html';
import { renderPlainText } from '../../src/doc/text';
import { sampleSession } from './sample';

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

const model = buildDocumentModel(sampleSession(), { incomplete: false });
let preview: HTMLElement;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  preview = document.createElement('div');
  preview.textContent = 'preview text';
  document.body.appendChild(preview);
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  preview.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyRichText (AC-6, AC-7)', () => {
  it('writes a ClipboardItem with text/html and text/plain and reports "clipboard"', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const result = await copyRichText(model, preview, {
      clipboard: { write },
      ClipboardItemCtor: FakeClipboardItem as never,
    });
    expect(result).toBe('clipboard');
    const item = write.mock.calls[0]![0][0] as FakeClipboardItem;
    expect(Object.keys(item.items).sort()).toEqual(['text/html', 'text/plain']);
    expect(await item.items['text/html']!.text()).toBe(renderHtmlFragment(model));
    expect(await item.items['text/plain']!.text()).toBe(renderPlainText(model));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to selecting the preview and the legacy copy command when the feature is missing', async () => {
    const exec = vi.fn().mockReturnValue(true);
    const result = await copyRichText(model, preview, { clipboard: null, exec });
    expect(result).toBe('fallback');
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('falls back when the clipboard feature rejects', async () => {
    const exec = vi.fn().mockReturnValue(true);
    const result = await copyRichText(model, preview, {
      clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) },
      ClipboardItemCtor: FakeClipboardItem as never,
      exec,
    });
    expect(result).toBe('fallback');
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('reports "failed" when both ways fail', async () => {
    const failing = await copyRichText(model, preview, {
      clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) },
      ClipboardItemCtor: FakeClipboardItem as never,
      exec: vi.fn().mockReturnValue(false),
    });
    expect(failing).toBe('failed');
    const throwing = await copyRichText(model, preview, {
      clipboard: null,
      exec: () => {
        throw new Error('no copy command');
      },
    });
    expect(throwing).toBe('failed');
  });

  it('sends nothing over the network', async () => {
    await copyRichText(model, preview, { clipboard: null, exec: vi.fn().mockReturnValue(true) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
