import { useApp } from '../../app/context';
import { listFormats } from '../../formats/library';
import { isComplete } from '../../formats/questionnaire';
import { texts } from '../../texts';
import { FormatCard } from './FormatCard';

export function LibraryPage() {
  const app = useApp();
  const flow = app.flow;
  const answers = flow.answers.value;
  return (
    <div class="page">
      <h2>{texts.libraryHeading}</h2>
      {flow.error.value && (
        <p class="error" role="alert">
          {flow.error.value}
        </p>
      )}
      <div class="cards">
        {listFormats().map((f) => (
          <FormatCard
            key={f.id}
            format={f}
            actions={
              <>
                <button type="button" onClick={() => flow.openDetails(f.id, 'library')}>
                  {texts.seeDetails}
                </button>
                <button type="button" class="primary" onClick={() => flow.useFormat(f)}>
                  {texts.useThisFormat}
                </button>
              </>
            }
          />
        ))}
      </div>
      <div class="row">
        {isComplete(answers) && flow.recommendation.value && (
          <button type="button" class="link" onClick={() => flow.showRecommendation()}>
            {texts.backToSuggestion}
          </button>
        )}
        <button type="button" class="link" onClick={() => flow.backToQuestionnaire()}>
          {texts.backToQuestions}
        </button>
      </div>
    </div>
  );
}
