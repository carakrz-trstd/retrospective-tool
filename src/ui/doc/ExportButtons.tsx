import type { RefObject } from 'preact';
import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { copyRichText } from '../../doc/clipboard';
import { renderCsv } from '../../doc/csv';
import { downloadFile } from '../../doc/download';
import { fileName } from '../../doc/filenames';
import { renderHtmlDocument } from '../../doc/html';
import { renderMarkdown } from '../../doc/markdown';
import type { DocumentModel, ExportKind } from '../../doc/model';
import { texts } from '../../texts';

type Message = { tone: 'ok' | 'warn' | 'error'; text: string };

/** The four exports. Each shows its result in a live region; the others stay available. */
export function ExportButtons(props: { model: DocumentModel; previewRef: RefObject<HTMLElement | null> }) {
  const app = useApp();
  const { model } = props;
  const [messages, setMessages] = useState<Partial<Record<ExportKind, Message>>>({});
  const say = (kind: ExportKind, message: Message) => setMessages((m) => ({ ...m, [kind]: message }));

  const download = (kind: ExportKind, make: () => void, done: string) => {
    try {
      make();
      app.markExport(kind);
      say(kind, { tone: 'ok', text: done });
    } catch {
      say(kind, { tone: 'error', text: texts.doc.downloadFailed });
    }
  };

  const copy = async () => {
    const element = props.previewRef.current;
    const result = element ? await copyRichText(model, element) : 'failed';
    if (result === 'failed') return say('rich', { tone: 'error', text: texts.doc.copyFailed });
    app.markExport('rich');
    say(
      'rich',
      result === 'clipboard'
        ? { tone: 'ok', text: texts.doc.copied }
        : { tone: 'warn', text: texts.doc.copiedFallback },
    );
  };

  const item = (kind: ExportKind, label: string, hint: string, onClick: () => void) => (
    <div class="export-item">
      <button type="button" class="primary" onClick={onClick}>
        {label}
      </button>
      <span class="hint">{hint}</span>
      <p class={`export-message ${messages[kind]?.tone ?? ''}`} role="status">
        {messages[kind]?.text}
      </p>
    </div>
  );

  return (
    <section aria-label={texts.doc.exportsHeading}>
      <div class="export-buttons">
        {item('markdown', texts.doc.downloadMarkdown, texts.doc.hintMarkdown, () =>
          download(
            'markdown',
            () => downloadFile(fileName(model, 'markdown'), 'text/markdown', renderMarkdown(model)),
            texts.doc.markdownDone,
          ),
        )}
        {item('rich', texts.doc.copyConfluence, texts.doc.hintConfluence, () => void copy())}
        {item('html', texts.doc.downloadHtml, texts.doc.hintHtml, () =>
          download(
            'html',
            () => downloadFile(fileName(model, 'html'), 'text/html', renderHtmlDocument(model)),
            texts.doc.htmlDone,
          ),
        )}
        {item('csv', texts.doc.downloadCsv, texts.doc.hintCsv, () =>
          download(
            'csv',
            () => downloadFile(fileName(model, 'csv'), 'text/csv', renderCsv(model)),
            texts.doc.csvDone,
          ),
        )}
      </div>
      <p class="hint">{texts.doc.phoneHint}</p>
    </section>
  );
}
