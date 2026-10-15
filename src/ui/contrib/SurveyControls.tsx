import { useState } from 'preact/hooks';
import { useApp } from '../../app/context';
import { getContribView } from '../../contrib/types';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { ConfirmDialog } from '../ConfirmDialog';

/** "Close survey" for the Facilitator, with a confirmation. */
export function SurveyControls(props: PhaseViewProps) {
  const app = useApp();
  const [asking, setAsking] = useState(false);
  if (getContribView(props.state).survey.closed) return null;
  return (
    <>
      <button type="button" onClick={() => setAsking(true)}>
        {texts.contrib.closeSurvey}
      </button>
      {asking && (
        <ConfirmDialog
          title={texts.contrib.closeSurveyTitle}
          confirmLabel={texts.contrib.closeSurvey}
          onConfirm={() => {
            app.sendIntent('survey.close', {});
            setAsking(false);
          }}
          onCancel={() => setAsking(false)}
        >
          <p>{texts.contrib.closeSurveyBody}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
