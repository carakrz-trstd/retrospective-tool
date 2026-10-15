import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { COMMENT_MAX, normalizeText, truncate } from '../../contrib/limits';
import { getContribView, type Rating } from '../../contrib/types';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { CharCounter } from './CharCounter';
import { activeParticipants } from './names';
import { RejectedNotice } from './RejectedNotice';
import { SurveyResults } from './SurveyResults';

const RATINGS: Rating[] = [1, 2, 3, 4, 5];

function RatingGroup(props: {
  legend: string;
  group: string;
  value: Rating | null;
  disabled: boolean;
  onChange: (r: Rating) => void;
}) {
  return (
    <fieldset class="rating-group">
      <legend>{props.legend}</legend>
      <div class="options" role="radiogroup" aria-label={props.group}>
        {RATINGS.map((n) => (
          <label key={n} class="option">
            <input
              type="radio"
              name={props.group}
              aria-label={texts.contrib.ratingOption(props.group, n)}
              checked={props.value === n}
              disabled={props.disabled}
              onChange={() => props.onChange(n)}
            />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Check-out: a 1-5 rating and a comment about the retro and about the tool; anonymous. */
export function SurveyView(props: PhaseViewProps) {
  const app = useApp();
  const view = getContribView(props.state);
  const mine = app.mySurvey.value?.answer;
  const final = view.survey.closed || props.state.status === 'ended';
  const [retro, setRetro] = useState<Rating | null>(mine?.retroRating ?? null);
  const [tool, setTool] = useState<Rating | null>(mine?.toolRating ?? null);
  const [retroComment, setRetroComment] = useState(mine?.retroComment ?? '');
  const [toolComment, setToolComment] = useState(mine?.toolComment ?? '');
  const total = activeParticipants(props.state).length;
  const ready = retro !== null && tool !== null;

  const submit = (e: Event) => {
    e.preventDefault();
    if (!ready || final) return;
    const rc = normalizeText(retroComment);
    const tc = normalizeText(toolComment);
    app.submitSurvey({
      retroRating: retro,
      ...(rc ? { retroComment: rc } : {}),
      toolRating: tool,
      ...(tc ? { toolComment: tc } : {}),
    });
  };

  return (
    <section class="contrib-survey" aria-label="Check-out survey">
      <RejectedNotice />
      <form onSubmit={submit} noValidate>
        <RatingGroup
          legend={texts.contrib.surveyRetro}
          group={texts.contrib.retroRating}
          value={retro}
          disabled={final}
          onChange={setRetro}
        />
        <label>
          {texts.contrib.retroComment}
          <textarea
            rows={2}
            disabled={final}
            value={retroComment}
            onInput={(e) => setRetroComment(truncate(e.currentTarget.value, COMMENT_MAX))}
          />
        </label>
        <CharCounter text={retroComment} max={COMMENT_MAX} />
        <RatingGroup
          legend={texts.contrib.surveyTool}
          group={texts.contrib.toolRating}
          value={tool}
          disabled={final}
          onChange={setTool}
        />
        <label>
          {texts.contrib.toolComment}
          <textarea
            rows={2}
            disabled={final}
            value={toolComment}
            onInput={(e) => setToolComment(truncate(e.currentTarget.value, COMMENT_MAX))}
          />
        </label>
        <CharCounter text={toolComment} max={COMMENT_MAX} />
        {final ? (
          <p class="hint">{texts.contrib.surveyClosed}</p>
        ) : (
          <>
            <button type="submit" class="primary" disabled={!ready}>
              {mine ? texts.contrib.updateAnswers : texts.contrib.submitAnswers}
            </button>
            <p class="hint">{texts.contrib.surveyChangeHint}</p>
          </>
        )}
      </form>
      <p class="survey-count" role="status">
        {texts.contrib.surveyCount(view.survey.count, total)}
      </p>
      {final && view.survey.answers && <SurveyResults answers={view.survey.answers} />}
    </section>
  );
}
