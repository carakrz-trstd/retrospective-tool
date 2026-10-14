import { useApp } from '../../app/context';
import {
  addColumn,
  moveColumn,
  removeColumn,
  renameColumn,
  setCheckIn,
  setPrompt,
} from '../../formats/custom';
import { defaults } from '../../formats/defaults';
import { COLUMN_NAME_MAX, CUSTOM_MAX_COLUMNS, PROMPT_MAX } from '../../formats/validate';
import { texts } from '../../texts';

/** The inline message for a column field, from the validation messages ("columns.1.name: ..."). */
function fieldError(errors: string[], index: number, field: 'name' | 'prompt'): string | null {
  const message = errors.find((e) => e.startsWith(`columns.${index}.${field}`));
  if (!message) return null;
  if (field === 'prompt') return texts.promptTooLong;
  if (message.includes('different')) return texts.columnNamesDifferent;
  if (message.includes('at most')) return texts.columnNameTooLong;
  return texts.columnNameEmpty;
}

export function CustomFormatPage() {
  const app = useApp();
  const flow = app.flow;
  const draft = flow.draft.value;
  if (!draft) return null;
  const errors = flow.draftErrors.value;
  const generalErrors = errors.filter((e) => !e.startsWith('columns.') || /^columns:/.test(e));
  const canAdd = draft.columns.length < CUSTOM_MAX_COLUMNS;
  const canRemove = draft.columns.length > 2;

  return (
    <div class="page">
      <h2>{texts.customHeading}</h2>
      <p class="hint">{texts.customIntro}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          flow.saveCustom();
        }}
      >
        {draft.columns.map((c, i) => {
          const n = i + 1;
          const nameError = fieldError(errors, i, 'name');
          const promptError = fieldError(errors, i, 'prompt');
          return (
            <fieldset key={c.id} class="column-editor">
              <legend>Column {n}</legend>
              <label for={`col-name-${c.id}`}>{texts.columnName(n)}</label>
              <input
                id={`col-name-${c.id}`}
                type="text"
                maxLength={COLUMN_NAME_MAX}
                value={c.name}
                aria-invalid={nameError ? 'true' : undefined}
                onInput={(e) => flow.setDraft(renameColumn(draft, c.id, e.currentTarget.value))}
              />
              <p class="hint">{texts.charactersLeft(COLUMN_NAME_MAX - c.name.length)}</p>
              {nameError && (
                <p class="error" role="alert">
                  {nameError}
                </p>
              )}
              <label for={`col-prompt-${c.id}`}>{texts.columnPrompt(n)}</label>
              <input
                id={`col-prompt-${c.id}`}
                type="text"
                maxLength={PROMPT_MAX}
                value={c.prompt ?? ''}
                onInput={(e) => flow.setDraft(setPrompt(draft, c.id, e.currentTarget.value))}
              />
              <p class="hint">{texts.charactersLeft(PROMPT_MAX - (c.prompt ?? '').length)}</p>
              {promptError && (
                <p class="error" role="alert">
                  {promptError}
                </p>
              )}
              <div class="row">
                <button
                  type="button"
                  aria-label={texts.moveUp(n)}
                  disabled={i === 0}
                  onClick={() => flow.setDraft(moveColumn(draft, c.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={texts.moveDown(n)}
                  disabled={i === draft.columns.length - 1}
                  onClick={() => flow.setDraft(moveColumn(draft, c.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={texts.removeColumn(n)}
                  disabled={!canRemove}
                  onClick={() => {
                    const r = removeColumn(draft, c.id);
                    if (r.ok) flow.setDraft(r.format);
                  }}
                >
                  {texts.removeColumn(n)}
                </button>
              </div>
            </fieldset>
          );
        })}
        <div class="row">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              const r = addColumn(draft);
              if (r.ok) flow.setDraft(r.format);
            }}
          >
            {texts.addColumn}
          </button>
          {!canAdd && <span class="hint">{texts.tooManyColumns}</span>}
        </div>
        <label for="custom-checkin">{texts.checkInSelect}</label>
        <select
          id="custom-checkin"
          value={draft.checkInQuestion}
          onChange={(e) => {
            const r = setCheckIn(draft, e.currentTarget.value);
            if (r.ok) flow.setDraft(r.format);
          }}
        >
          {defaults.checkInQuestions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        {generalErrors.length > 0 && (
          <ul class="error" role="alert">
            {generalErrors.map((e) => (
              <li key={e}>{e.replace(/^columns: /, '')}</li>
            ))}
          </ul>
        )}
        {flow.error.value && (
          <p class="error" role="alert">
            {flow.error.value}
          </p>
        )}
        <div class="row">
          <button type="submit" class="primary">
            {texts.saveAndContinue}
          </button>
          <button type="button" class="link" onClick={() => flow.backToQuestionnaire()}>
            {texts.backToQuestions}
          </button>
        </div>
      </form>
    </div>
  );
}
