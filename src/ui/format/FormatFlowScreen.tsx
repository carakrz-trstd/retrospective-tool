import { useApp } from '../../app/context';
import { CustomFormatPage } from './CustomFormatPage';
import { FormatDetailsPage } from './FormatDetailsPage';
import { LibraryPage } from './LibraryPage';
import { QuestionnairePage } from './QuestionnairePage';
import { RecommendationPage } from './RecommendationPage';
import { TimeBudgetStep } from './TimeBudgetStep';

/** The screens of the format selection, switched by the step of the flow. */
export function FormatFlowScreen() {
  const app = useApp();
  switch (app.flow.step.value) {
    case 'recommendation':
      return <RecommendationPage />;
    case 'library':
      return <LibraryPage />;
    case 'details':
      return <FormatDetailsPage />;
    case 'custom':
      return <CustomFormatPage />;
    case 'time':
      return <TimeBudgetStep />;
    default:
      return <QuestionnairePage />;
  }
}
