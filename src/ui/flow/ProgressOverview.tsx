import { useApp } from '../../app/context';
import { getPhaseTexts } from '../../flow/data/schema';
import { STOPS, label, stopToPhase } from '../../flow/stops';
import { formatClock, used, IDLE } from '../../flow/timer';
import type { StopId } from '../../flow/types';
import { PHASES } from '../../formats/types';
import { texts } from '../../texts';
import { useTick } from './useTick';

const STEP_NAMES: Record<string, string> = {
  'retro.write': 'Write silently',
  'retro.reveal': 'Reveal',
  'retro.discuss': 'Discuss',
};

type StepState = 'done' | 'current' | 'upcoming';

/** The Facilitator's stepper: all stops with planned and used time; selecting one moves the session there. */
export function ProgressOverview() {
  const app = useApp();
  useTick(1000);
  const flow = app.flowState();
  const now = app.clock.hostNow();
  const currentIndex = STOPS.indexOf(flow.stop);

  const stateOf = (stops: StopId[]): StepState => {
    const indexes = stops.map((s) => STOPS.indexOf(s));
    if (indexes.every((i) => i < currentIndex)) return 'done';
    return indexes.includes(currentIndex) ? 'current' : 'upcoming';
  };
  const usedMs = (stop: StopId) => used(flow.timers[stop] ?? IDLE, app.stopDuration(stop), now);
  const stopButton = (stop: StopId, name: string) => (
    <button
      type="button"
      data-stop={stop}
      aria-current={flow.stop === stop ? 'step' : undefined}
      class={flow.stop === stop ? 'stop current' : 'stop'}
      onClick={() => app.flowIntent('flow.goto', { stop })}
    >
      <span class="stop-name">{name}</span>{' '}
      <span class="hint">
        {texts.flow.plannedMin(Math.round(app.stopDuration(stop) / 60_000))},{' '}
        {texts.flow.usedTime(formatClock(usedMs(stop)))}
      </span>
    </button>
  );

  const totalPlanned = STOPS.reduce((n, s) => n + app.stopDuration(s), 0);
  const totalUsed = STOPS.reduce((n, s) => n + usedMs(s), 0);
  const percent = totalPlanned > 0 ? Math.min(100, Math.round((totalUsed / totalPlanned) * 100)) : 0;

  return (
    <nav aria-label={texts.flow.sessionSteps} class="progress">
      <details open>
        <summary>{texts.flow.progress}</summary>
        <ol class="stepper">
          {PHASES.map((phase, index) => {
            const stops = STOPS.filter((s) => stopToPhase(s) === phase);
            const state = stateOf(stops);
            const title = getPhaseTexts().phases.find((p) => p.id === phase)!.title;
            return (
              <li key={phase} data-phase={phase} data-state={state}>
                <span class="step-marker" aria-hidden="true">
                  {state === 'done' ? '✓' : index + 1}
                </span>
                <div class="step-body">
                  {phase === 'retro' ? (
                    <>
                      <span class="stop-name">{title}</span>
                      <ol class="substeps">
                        {stops.map((s) => (
                          <li key={s} data-state={stateOf([s])}>
                            {stopButton(s, STEP_NAMES[s] ?? label(s))}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    stopButton(stops[0]!, title)
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div class="total-bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <p class="hint">
          {texts.flow.usedOfPlanned(Math.floor(totalUsed / 60_000), Math.round(totalPlanned / 60_000))}
        </p>
      </details>
    </nav>
  );
}
