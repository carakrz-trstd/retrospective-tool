import { useApp } from '../../app/context';
import { questionnaire } from '../../formats/questionnaire';
import { isComplete } from '../../formats/questionnaire';
import { texts } from '../../texts';

export function QuestionnairePage() {
  const app = useApp();
  const flow = app.flow;
  const answers = flow.answers.value;
  const complete = isComplete(answers);
  const attempted = flow.attempted.value;

  return (
    <div class="page">
      <h2>{texts.newHeading}</h2>
      <p class="hint">{texts.questionnaireIntro}</p>
      <form
        class="questionnaire"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          flow.showRecommendation();
        }}
      >
        {questionnaire.map((q) => {
          const missing = attempted && answers[q.key] === undefined;
          return (
            <fieldset
              key={q.id}
              aria-describedby={`help-${q.id}`}
              data-missing={missing ? 'true' : undefined}
            >
              <legend>{q.label}</legend>
              <p id={`help-${q.id}`} class="hint">
                {q.help}
              </p>
              <div class="options">
                {q.options.map((o) => (
                  <label key={String(o.value)} class="option">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.key] === o.value}
                      onChange={() => flow.setAnswer(q.key as never, o.value as never)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              {missing && (
                <p class="error" role="alert">
                  {texts.unanswered}
                </p>
              )}
            </fieldset>
          );
        })}
        <div class="row">
          <button type="submit" class="primary" aria-disabled={complete ? 'false' : 'true'}>
            {texts.showRecommendation}
          </button>
        </div>
      </form>
      <div class="row">
        <button type="button" class="link" onClick={() => flow.openLibrary()}>
          {texts.browseAll}
        </button>
        <button type="button" class="link" onClick={() => flow.startCustom()}>
          {texts.createCustom}
        </button>
        <button type="button" class="link" onClick={() => app.goHome()}>
          {texts.cancel}
        </button>
      </div>
    </div>
  );
}
