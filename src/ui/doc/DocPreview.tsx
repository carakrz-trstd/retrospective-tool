import type { RefObject } from 'preact';
import { Fragment } from 'preact';
import { toBlocks, type Block } from '../../doc/blocks';
import type { DocumentModel } from '../../doc/model';
import { texts } from '../../texts';

/** Text with its line breaks (Preact escapes the text itself; nothing is injected as HTML). */
function Lines(props: { text: string }) {
  return (
    <>
      {props.text.split(/\r\n?|\n/).map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function BlockView(props: { block: Block }) {
  const b = props.block;
  switch (b.t) {
    case 'h1':
      return (
        <h1>
          <Lines text={b.text} />
        </h1>
      );
    case 'h2':
      return (
        <h2>
          <Lines text={b.text} />
        </h2>
      );
    case 'h3':
      return (
        <h3>
          <Lines text={b.text} />
        </h3>
      );
    case 'p':
    case 'note':
      return (
        <p>
          <Lines text={b.text} />
        </p>
      );
    case 'em':
      return (
        <p>
          <em>
            <Lines text={b.text} />
          </em>
        </p>
      );
    case 'ul':
      return (
        <ul>
          {b.items.map((item, i) => (
            <li key={i}>
              <Lines text={item} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <table>
          <thead>
            <tr>
              {b.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <Lines text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

/** The documentation as it will be exported: the same blocks as the HTML export. */
export function DocPreview(props: { model: DocumentModel; previewRef: RefObject<HTMLElement | null> }) {
  return (
    <article class="doc-preview" aria-label={texts.doc.previewLabel} ref={props.previewRef}>
      {toBlocks(props.model).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </article>
  );
}
