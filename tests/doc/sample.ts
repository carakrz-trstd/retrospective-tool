import type { SessionState } from '../../src/core/types';
import { A, B, F, makeState, must, remove, reveal } from '../contrib/stateBuilder';

export const CAROL = 'p-carol';
export const SPECIAL = '*bold* <b>x</b> =SUM(A1), "quoted" & more';

export interface SampleOptions {
  title?: string;
  /** Leave the entries hidden (the Facilitator never revealed). */
  hidden?: boolean;
  /** Add the entries with special characters. */
  special?: boolean;
}

/** A finished session: Fiona (Facilitator), Alex, Blake and a removed Carol; everything revealed. */
export function sampleSession(opts: SampleOptions = {}): SessionState {
  let s = makeState({
    createdAt: new Date(2026, 2, 1, 12, 0, 0).getTime(), // local noon: the date is 2026-03-01 in every time zone
    ...(opts.title ? { title: opts.title } : {}),
  });
  s = {
    ...s,
    format: { ...s.format, name: 'Start-Stop-Continue', checkInQuestion: 'How are you arriving today?' },
    participants: {
      ...s.participants,
      [F]: { ...s.participants[F]!, role: 'Scrum Master', joinedAt: 1 },
      [A]: { ...s.participants[A]!, role: 'Developer', joinedAt: 2 },
      [B]: { ...s.participants[B]!, role: 'Tester', joinedAt: 3 },
      [CAROL]: {
        id: CAROL,
        name: 'Carol',
        displayName: 'Carol',
        role: 'Designer',
        isFacilitator: false,
        presence: 'online',
        status: 'active',
        joinedAt: 4,
      },
    },
  };
  s = must(s, A, 'entry.add', { id: 'c-a', kind: 'checkIn', text: 'sleepy but here' }, 1_000);
  s = must(s, B, 'entry.add', { id: 'c-b', kind: 'checkIn', text: 'fine' }, 1_001);
  s = must(s, CAROL, 'entry.add', { id: 'c-c', kind: 'checkIn', text: 'carol check-in' }, 1_002);
  s = must(s, A, 'entry.add', { id: 'r-1', kind: 'retro', columnId: 'a', text: 'start testing' }, 2_000);
  s = must(s, B, 'entry.add', { id: 'r-2', kind: 'retro', columnId: 'b', text: 'stop meetings' }, 2_001);
  s = must(s, CAROL, 'entry.add', { id: 'r-3', kind: 'retro', columnId: 'a', text: 'carol retro' }, 2_002);
  if (opts.special) {
    s = must(s, A, 'entry.add', { id: 'r-4', kind: 'retro', columnId: 'c', text: SPECIAL }, 2_003);
  }
  s = must(s, A, 'note.add', { id: 'n-1', text: 'we agreed on X' }, 3_000);
  s = must(s, F, 'note.taker', { participantId: B });
  s = must(s, A, 'action.add', {
    id: 'x-1',
    description: 'write the docs',
    ownerIds: [A, B],
    dueDate: '2026-03-15',
  });
  s = must(s, null, 'survey.submit', {
    answerKey: 'key-one',
    answer: { retroRating: 5, retroComment: 'great retro', toolRating: 4 },
  });
  s = must(s, null, 'survey.submit', {
    answerKey: 'key-two',
    answer: { retroRating: 4, toolRating: 3, toolComment: 'slow on my phone' },
  });
  s = must(s, F, 'survey.close', {});
  s = remove(s, CAROL);
  if (!opts.hidden) s = reveal(reveal(s, 'checkIn'), 'retro');
  return { ...s, status: 'ended' };
}

/** A tiny CSV reader (RFC 4180): quoted cells, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
