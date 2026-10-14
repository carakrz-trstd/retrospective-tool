import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { supportedBudgets } from '../../formats/library';
import type { TimeBudget } from '../../formats/types';
import { texts } from '../../texts';

/** Asks for the length of the session when a format was chosen before the time was known. */
export function TimeBudgetStep() {
  const app = useApp();
  const flow = app.flow;
  const format = flow.pending.value;
  const [picked, setPicked] = useState<TimeBudget | null>(null);
  if (!format) return null;
  const options = supportedBudgets(format);

  return (
    <div class="page">
      <h2>{texts.timeHeading}</h2>
      <p class="hint">{texts.timeIntro(format.name)}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (picked) flow.chooseTime(picked);
        }}
      >
        <fieldset>
          <legend class="sr-only">{texts.timeHeading}</legend>
          <div class="options">
            {options.map((b) => (
              <label key={b} class="option">
                <input type="radio" name="time-budget" checked={picked === b} onChange={() => setPicked(b)} />
                <span>
                  {b} {texts.minutesShort}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {flow.error.value && (
          <p class="error" role="alert">
            {flow.error.value}
          </p>
        )}
        <div class="row">
          <button type="submit" class="primary" aria-disabled={picked ? 'false' : 'true'}>
            {texts.timeContinue}
          </button>
          <button type="button" class="link" onClick={() => flow.backToQuestionnaire()}>
            {texts.backToQuestions}
          </button>
        </div>
      </form>
    </div>
  );
}
