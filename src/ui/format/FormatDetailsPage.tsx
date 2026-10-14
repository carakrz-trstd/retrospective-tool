import { useApp } from '../../app/context';
import { getFormat, supportedBudgets, timeSplitFor } from '../../formats/library';
import { isComplete } from '../../formats/questionnaire';
import { texts } from '../../texts';
import { SplitList } from './SplitList';

export function FormatDetailsPage() {
  const app = useApp();
  const flow = app.flow;
  const format = flow.detailsId.value ? getFormat(flow.detailsId.value) : undefined;
  if (!format) return null;
  const answers = flow.answers.value;
  const answeredBudget = isComplete(answers) ? answers.timeBudgetMin : undefined;
  const budgets =
    answeredBudget && timeSplitFor(format, answeredBudget) ? [answeredBudget] : supportedBudgets(format);

  return (
    <div class="page">
      <h2>{format.name}</h2>
      <p>{format.description}</p>
      <p class="hint">
        {format.source ? (
          <a href={format.source.url} target="_blank" rel="noopener noreferrer">
            {texts.basedOn(format.name)}
          </a>
        ) : (
          texts.neutralSource
        )}
      </p>
      <section aria-labelledby="columns-heading">
        <h3 id="columns-heading">{texts.columnsLabel}</h3>
        <ul>
          {format.columns.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.prompt ? `: ${c.prompt}` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="time-heading">
        <h3 id="time-heading">{texts.timeSplitLabel}</h3>
        {budgets.map((b) => (
          <SplitList key={b} split={timeSplitFor(format, b)!} budget={b} />
        ))}
      </section>
      <section aria-labelledby="checkin-heading">
        <h3 id="checkin-heading">{texts.checkInQuestionLabel}</h3>
        <p>{format.checkInQuestion}</p>
      </section>
      <section aria-labelledby="tips-heading">
        <h3 id="tips-heading">{texts.tipsLabel}</h3>
        <ul>
          {format.facilitationTips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      {flow.error.value && (
        <p class="error" role="alert">
          {flow.error.value}
        </p>
      )}
      <div class="row">
        <button type="button" class="primary" onClick={() => flow.useFormat(format)}>
          {texts.useThisFormat}
        </button>
        <button type="button" onClick={() => flow.useAsBasis(format.id)}>
          {texts.useAsBasis}
        </button>
        <button type="button" class="link" onClick={() => flow.backFromDetails()}>
          {texts.back}
        </button>
      </div>
    </div>
  );
}
