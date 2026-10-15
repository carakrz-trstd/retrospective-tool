import { aggregate } from '../../contrib/survey';
import type { SurveyAnswer } from '../../contrib/types';
import { texts } from '../../texts';

function Question(props: { title: string; result: ReturnType<typeof aggregate>['retro']; count: number }) {
  const average = props.result.average === null ? '–' : props.result.average.toFixed(1);
  return (
    <div class="survey-question">
      <p>{texts.contrib.averageLine(props.title, average, props.count)}</p>
      <p class="hint">{texts.contrib.distributionLine(props.result.distribution)}</p>
      <h4>{texts.contrib.commentsHeading}</h4>
      {props.result.comments.length === 0 ? (
        <p class="hint">{texts.contrib.noComments}</p>
      ) : (
        <ul>
          {props.result.comments.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Aggregate and comments of the survey, without names. Shown only when the survey is final. */
export function SurveyResults(props: { answers: SurveyAnswer[] }) {
  const results = aggregate(props.answers);
  return (
    <section class="survey-results" aria-label={texts.contrib.surveyResults}>
      <h3>{texts.contrib.surveyResults}</h3>
      <Question title="Retrospective" result={results.retro} count={results.count} />
      <Question title="Tool" result={results.tool} count={results.count} />
    </section>
  );
}
