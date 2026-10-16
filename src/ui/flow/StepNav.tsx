import { useApp } from '../../app/context';
import { STOPS, label, next, prev } from '../../flow/stops';
import type { StopId } from '../../flow/types';
import { texts } from '../../texts';

/** Segmented strip: how far the session is. */
export function StepHeader() {
  const app = useApp();
  const stop = app.flowState().stop;
  const current = STOPS.indexOf(stop);
  return (
    <div class="step-header">
      <p class="step-count">{texts.flow.stepOf(current + 1, STOPS.length)}</p>
      <ol class="step-dots" aria-hidden="true">
        {STOPS.map((s, i) => (
          <li key={s} class={i < current ? 'done' : i === current ? 'current' : ''} />
        ))}
      </ol>
    </div>
  );
}

/**
 * The step before and the step after. The Facilitator moves with these buttons; participants follow
 * the Facilitator and only see the same two cards, so they know what was just done and what comes next.
 */
export function StepNav() {
  const app = useApp();
  const stop = app.flowState().stop;
  const isFacilitator = app.role.value === 'host';
  const before: StopId | null = prev(stop) !== stop ? prev(stop) : null;
  const after: StopId | null = next(stop) !== stop ? next(stop) : null;

  const preview = (target: StopId | null, empty: string) => (
    <>
      <span class="title">{target ? label(target) : empty}</span>
      {target && (
        <span class="min">{texts.flow.plannedMin(Math.round(app.stopDuration(target) / 60_000))}</span>
      )}
    </>
  );

  if (isFacilitator) {
    return (
      <nav class="step-nav" aria-label="Step navigation">
        <button
          type="button"
          class="step-nav-button prev"
          aria-label={texts.flow.previous}
          disabled={!before}
          onClick={() => app.flowIntent('flow.prev')}
        >
          <span class="dir">← {texts.flow.previous}</span>
          {preview(before, texts.flow.startOfSession)}
        </button>
        <button
          type="button"
          class="step-nav-button next primary"
          aria-label={texts.flow.next}
          disabled={!after}
          onClick={() => app.flowIntent('flow.next')}
        >
          <span class="dir">{texts.flow.next} →</span>
          {preview(after, texts.flow.endOfSession)}
        </button>
      </nav>
    );
  }

  return (
    <div class="step-nav" aria-label="Step overview">
      <div class="step-card prev">
        <span class="dir">{texts.flow.justBefore}</span>
        {preview(before, texts.flow.startOfSession)}
      </div>
      <div class="step-card next">
        <span class="dir">{texts.flow.comingUp}</span>
        {preview(after, texts.flow.endOfSession)}
      </div>
    </div>
  );
}
