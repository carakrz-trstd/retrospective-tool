// "Copy for Confluence": formatted HTML and plain text with the browser's clipboard feature, with
// a fallback that selects the visible preview and uses the legacy copy command.
import { renderHtmlFragment } from './html';
import type { DocumentModel } from './model';
import { renderPlainText } from './text';

export type CopyResult = 'clipboard' | 'fallback' | 'failed';

export interface ClipboardEnv {
  clipboard?: { write(items: unknown[]): Promise<void> } | null;
  ClipboardItemCtor?: (new (items: Record<string, Blob>) => unknown) | null;
  exec?: (command: string) => boolean;
}

function selectContents(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

export async function copyRichText(
  model: DocumentModel,
  previewElement: HTMLElement,
  env: ClipboardEnv = {},
): Promise<CopyResult> {
  const clipboard = 'clipboard' in env ? env.clipboard : (globalThis.navigator?.clipboard ?? null);
  const Item =
    'ClipboardItemCtor' in env
      ? env.ClipboardItemCtor
      : ((globalThis as { ClipboardItem?: ClipboardEnv['ClipboardItemCtor'] }).ClipboardItem ?? null);

  if (clipboard?.write && Item) {
    try {
      const item = new Item({
        'text/html': new Blob([renderHtmlFragment(model)], { type: 'text/html' }),
        'text/plain': new Blob([renderPlainText(model)], { type: 'text/plain' }),
      });
      await clipboard.write([item]);
      return 'clipboard';
    } catch {
      // not allowed or not supported: try the fallback
    }
  }
  try {
    selectContents(previewElement);
    const exec = env.exec ?? ((command: string) => document.execCommand(command));
    return exec('copy') ? 'fallback' : 'failed';
  } catch {
    return 'failed';
  }
}
