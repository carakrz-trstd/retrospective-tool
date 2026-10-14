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

/** The Facilitator's list of all stops with planned and used time; selecting one moves the session there. */
export function ProgressOverview() {
  const app = useApp();
  useTick(1000);
  const flow = app.flowState();
  const now = app.clock.hostNow();

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

  return (
    <nav aria-label={texts.flow.sessionSteps} class="progress">
      <details open>
        <summary>{texts.flow.progress}</summary>
        <ol>
          {PHASES.map((phase) => {
            const stops = STOPS.filter((s) => stopToPhase(s) === phase);
            const title = getPhaseTexts().phases.find((p) => p.id === phase)!.title;
            return (
              <li key={phase} data-phase={phase}>
                {phase === 'retro' ? (
                  <>
                    <span class="stop-name">{title}</span>
                    <ol>
                      {stops.map((s) => (
                        <li key={s}>{stopButton(s, STEP_NAMES[s] ?? label(s))}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  stopButton(stops[0]!, title)
                )}
              </li>
            );
          })}
        </ol>
        <p class="hint">
          {texts.flow.usedOfPlanned(Math.floor(totalUsed / 60_000), Math.round(totalPlanned / 60_000))}
        </p>
      </details>
    </nav>
  );
}
