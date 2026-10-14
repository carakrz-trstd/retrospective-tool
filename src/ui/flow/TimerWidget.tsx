import { useApp } from '../../app/context';
import { timerDisplay } from '../../flow/display';
import { formatOvertime } from '../../flow/timer';
import { texts } from '../../texts';
import { NotSyncedBadge } from './NotSyncedBadge';
import { useTick } from './useTick';

/** The timer of the current stop: time left, suggested time, state, "time is over" and overtime. */
export function TimerWidget() {
  const app = useApp();
  // components that read signals only re-render for their own state, so the clock ticks here
  useTick(250);
  const flow = app.flowState();
  const d = timerDisplay(flow, (s) => app.stopDuration(s), app.clock.hostNow(), app.connection.value.status);
  const suggestedMin = Math.round(d.durationMs / 60_000);
  return (
    <section class={`timer${d.over ? ' over' : ''}`} aria-label={texts.flow.timerLabel}>
      <p class="timer-time" role="timer">
        {d.text}
      </p>
      <p class="hint">{texts.flow.suggestedTime(suggestedMin)}</p>
      <p class="hint timer-status">{texts.flow.timerStatus[d.status]}</p>
      {d.over && (
        <p class="timer-over" role="alert">
          {texts.flow.timeIsOver} <span class="overtime">{formatOvertime(d.overtimeMs ?? 0)}</span>
        </p>
      )}
      {d.notSynchronized && <NotSyncedBadge />}
    </section>
  );
}
