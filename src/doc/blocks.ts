// The structure of the documentation as a short list of blocks. The preview, the Markdown, the
// HTML and the plain-text renderers all draw from the same blocks, so they show the same content.
import type { DocQuestion, DocumentModel } from './model';

export type Block =
  | { t: 'h1' | 'h2' | 'h3' | 'p' | 'em' | 'note'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] };

export const INCOMPLETE_NOTE = 'Incomplete: the Facilitator left before the session was ended.';

function question(label: string, q: DocQuestion): Block[] {
  const average = q.average === null ? '–' : q.average.toFixed(1);
  const blocks: Block[] = [
    { t: 'p', text: `${label}: average ${average} · ratings 1 to 5: ${q.distribution.join(' / ')}` },
  ];
  if (q.comments.length > 0) blocks.push({ t: 'ul', items: q.comments });
  return blocks;
}

export function toBlocks(model: DocumentModel): Block[] {
  const blocks: Block[] = [{ t: 'h1', text: model.heading }];
  if (model.incomplete) blocks.push({ t: 'note', text: INCOMPLETE_NOTE });
  const custom = model.format.custom ? ' (custom)' : '';
  blocks.push({
    t: 'p',
    text: `${model.date} · Format: ${model.format.name}${custom} · ${model.timeBudgetMin} minutes`,
  });

  blocks.push({ t: 'h2', text: 'Participants' });
  blocks.push({
    t: 'ul',
    items: model.participants.map((p) => `${p.name} (${p.role})${p.isFacilitator ? ', Facilitator' : ''}`),
  });

  blocks.push({ t: 'h2', text: 'Check-in' });
  blocks.push({ t: 'p', text: `Question: ${model.checkIn.question}` });
  blocks.push(
    model.checkIn.responses.length
      ? { t: 'ul', items: model.checkIn.responses.map((r) => `${r.author}: ${r.text}`) }
      : { t: 'em', text: 'No responses.' },
  );

  blocks.push({ t: 'h2', text: 'Retrospective' });
  for (const column of model.retro.columns) {
    blocks.push({ t: 'h3', text: column.name });
    if (column.prompt) blocks.push({ t: 'em', text: column.prompt });
    blocks.push(
      column.entries.length
        ? { t: 'ul', items: column.entries.map((e) => `${e.text} (${e.author})`) }
        : { t: 'em', text: 'No entries.' },
    );
  }

  blocks.push({ t: 'h2', text: 'Discussion notes' });
  if (model.notes.noteTaker) blocks.push({ t: 'p', text: `Note taker: ${model.notes.noteTaker}` });
  blocks.push(
    model.notes.items.length
      ? { t: 'ul', items: model.notes.items.map((n) => `${n.text} (${n.author})`) }
      : { t: 'em', text: 'No notes.' },
  );

  blocks.push({ t: 'h2', text: 'Action items' });
  blocks.push(
    model.actions.length
      ? {
          t: 'table',
          head: ['Action', 'Owner(s)', 'Due date'],
          rows: model.actions.map((a) => [a.description, a.owners.join(', '), a.dueDate ?? '–']),
        }
      : { t: 'em', text: 'No action items.' },
  );

  blocks.push({ t: 'h2', text: 'Check-out' });
  blocks.push({ t: 'p', text: `Answers: ${model.survey.answered}` });
  blocks.push(...question('Retrospective', model.survey.retro));
  blocks.push(...question('Tool', model.survey.tool));
  return blocks;
}
