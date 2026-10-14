import { useApp } from '../../app/context';
import { getPhaseTexts } from '../../flow/data/schema';
import { isRetro, label, stopToPhase, stopToStep } from '../../flow/stops';
import type { StopId } from '../../flow/types';
import { texts } from '../../texts';

/** Title and instruction of the current stop. Participants see the title and one line only. */
export function PhasePanel(props: { stop: StopId; isFacilitator: boolean }) {
  const app = useApp();
  const { stop, isFacilitator } = props;
  const phaseTexts = getPhaseTexts();
  const phase = phaseTexts.phases.find((p) => p.id === stopToPhase(stop))!;
  const stepId = stopToStep(stop);
  const step = stepId ? phaseTexts.retroSteps.find((s) => s.id === stepId) : undefined;
  const format = app.state.value?.format;
  const title = isRetro(stop) ? label(stop) : phase.title;
  // the review stop shows its reminder in the content area (ReviewActionsPanel)
  const oneLine = stop === 'reviewActions' ? undefined : (step ?? phase).oneLine;

  return (
    <section class="phase-panel" aria-label={title}>
      <h3>{title}</h3>
      {oneLine && <p>{oneLine}</p>}
      {isFacilitator && (
        <div class="facilitator-only">
          {!step && <p>{phase.instruction}</p>}
          {step && <p>{phase.instruction}</p>}
          {step && <p>{step.instruction}</p>}
          {stop === 'checkIn' && format?.checkInQuestion && (
            <p>
              <strong>{texts.flow.checkInQuestion}:</strong> {format.checkInQuestion}
            </p>
          )}
          {isRetro(stop) && format && format.facilitationTips.length > 0 && (
            <div>
              <h4>{texts.flow.tips}</h4>
              <ul>
                {format.facilitationTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
