import type { ExportMarks } from '../../doc/model';
import { texts } from '../../texts';

const KINDS = ['markdown', 'rich', 'html', 'csv'] as const;

/** "Markdown ✓ · Copied for Confluence – not yet · …" from the marks kept on this device. */
export function ExportStatus(props: { exports: ExportMarks }) {
  return (
    <ul class="export-status" aria-label={texts.doc.statusLabel}>
      {KINDS.map((kind) => {
        const name = texts.doc.statusNames[kind];
        return (
          <li key={kind} class={props.exports[kind] ? 'done' : 'todo'}>
            {props.exports[kind] ? texts.doc.statusDone(name) : texts.doc.statusTodo(name)}
          </li>
        );
      })}
    </ul>
  );
}
