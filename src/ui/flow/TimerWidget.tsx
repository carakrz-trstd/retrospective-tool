import { useApp } from '../../app/context';
import { timerDisplay } from '../../flow/display';
import { formatOvertime } from '../../flow/timer';
import { texts } from '../../texts';
import { NotSyncedBadge } from './NotSyncedBadge';
import { useTick } from './useTick';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The timer of the current stop: a ring that empties, time left, suggested time, state, "time is over" and overtime. */
export function TimerWidget() {
  const app = useApp();
  // components that read signals only re-render for their own state, so the clock ticks here
  useTick(250);
  const flow = app.flowState();
  const d = timerDisplay(flow, (s) => app.stopDuration(s), app.clock.hostNow(), app.connection.value.status);
  const suggestedMin = Math.round(d.durationMs / 60_000);
  const left = d.durationMs > 0 ? Math.max(0, Math.min(1, d.remainingMs / d.durationMs)) : 0;
  const tone = d.over ? 'over' : d.status !== 'idle' && left <= 0.2 ? 'low' : 'ok';
  return (
    <section class={`timer${d.over ? ' over' : ''}`} aria-label={texts.flow.timerLabel}>
      <div class="timer-face">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r={RADIUS} />
          <circle
            class={`ring-value ${tone}`}
            cx="60"
            cy="60"
            r={RADIUS}
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={CIRCUMFERENCE * (1 - (d.over ? 1 : left))}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <p class="timer-time" role="timer">
          {d.text}
        </p>
      </div>
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
