import { useApp } from '../../app/context';
import { isComplete } from '../../formats/questionnaire';
import type { Match } from '../../formats/scoring';
import { texts } from '../../texts';
import { FormatCard } from './FormatCard';

export function RecommendationPage() {
  const app = useApp();
  const flow = app.flow;
  const rec = flow.recommendation.value;
  const answers = flow.answers.value;
  if (!rec || !isComplete(answers)) return null;

  const card = (m: Match, badge: string, big: boolean) => (
    <FormatCard
      key={m.format.id}
      format={m.format}
      badge={badge}
      big={big}
      reasons={m.reasons}
      budget={answers.timeBudgetMin}
      actions={
        <>
          <button type="button" class="primary" onClick={() => flow.useFormat(m.format)}>
            {texts.useThisFormat}
          </button>
          <button type="button" onClick={() => flow.openDetails(m.format.id, 'recommendation')}>
            {texts.seeDetails}
          </button>
        </>
      }
    />
  );

  return (
    <div class="page">
      <h2>{texts.recommendationHeading}</h2>
      {rec.weak && (
        <p class="banner warn" role="status" data-testid="weak-note">
          {texts.weakNote}
        </p>
      )}
      {flow.error.value && (
        <p class="error" role="alert">
          {flow.error.value}
        </p>
      )}
      {card(rec.recommended, texts.recommendedBadge, true)}
      {rec.alternatives.map((m) => card(m, texts.alternativeBadge, false))}
      <div class="row">
        <button type="button" onClick={() => flow.openLibrary()}>
          {texts.browseAll}
        </button>
        <button type="button" onClick={() => flow.startCustom()}>
          {texts.createCustom}
        </button>
        <button type="button" class="link" onClick={() => flow.backToQuestionnaire()}>
          {texts.backToQuestions}
        </button>
      </div>
    </div>
  );
}
