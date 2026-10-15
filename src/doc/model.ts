// The document model: plain JSON-serializable data without markup. All renderers (preview,
// Markdown, HTML, plain text, CSV) are pure functions of it.

export const DOC_VERSION = 1;

export interface DocPerson {
  /** The display name. */
  name: string;
  role: string;
  isFacilitator: boolean;
}

export interface DocEntry {
  author: string;
  text: string;
}

export interface DocQuestion {
  average: number | null;
  distribution: [number, number, number, number, number];
  comments: string[];
}

export interface DocumentModel {
  version: typeof DOC_VERSION;
  /** True when built from what a device holds because the Facilitator left before ending the session. */
  incomplete: boolean;
  heading: string;
  title?: string;
  /** 'YYYY-MM-DD', the local date of the session creation. */
  date: string;
  format: { name: string; custom: boolean; columns: { name: string; prompt?: string }[] };
  timeBudgetMin: number;
  participants: DocPerson[];
  checkIn: { question: string; responses: DocEntry[] };
  retro: { columns: { name: string; prompt?: string; entries: DocEntry[] }[] };
  notes: { noteTaker?: string; items: { text: string; author: string }[] };
  actions: { description: string; owners: string[]; dueDate?: string }[];
  survey: { answered: number; retro: DocQuestion; tool: DocQuestion };
}

export type ExportKind = 'markdown' | 'rich' | 'html' | 'csv';
export type ExportMarks = Record<ExportKind, boolean>;

export const noExports = (): ExportMarks => ({ markdown: false, rich: false, html: false, csv: false });

/** What is stored on a device (localStorage key retro.final.<sessionId>). */
export interface FinalRecord {
  model: DocumentModel;
  exports: ExportMarks;
}

/** A light check of data that arrives from the network or from storage. */
export function isDocumentModel(value: unknown): value is DocumentModel {
  const m = value as Partial<DocumentModel> | null;
  return (
    typeof m === 'object' &&
    m !== null &&
    m.version === DOC_VERSION &&
    typeof m.heading === 'string' &&
    typeof m.date === 'string' &&
    Array.isArray(m.participants) &&
    typeof m.checkIn === 'object' &&
    m.checkIn !== null &&
    Array.isArray(m.retro?.columns) &&
    Array.isArray(m.actions) &&
    typeof m.survey === 'object' &&
    m.survey !== null
  );
}
