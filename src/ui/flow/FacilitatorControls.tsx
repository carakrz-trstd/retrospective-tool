import { useApp } from '../../app/context';
import { getPhaseControls } from '../../flow/registries';
import { isRetro, next, prev } from '../../flow/stops';
import { texts } from '../../texts';

/** Previous, Next, Reveal and the timer buttons, plus the controls other modules registered. */
export function FacilitatorControls() {
  const app = useApp();
  const state = app.state.value;
  if (!state) return null;
  const flow = app.flowState();
  const { stop } = flow;
  const revealKey = stop === 'checkIn' ? 'checkIn' : isRetro(stop) ? 'retro' : null;
  const running = flow.timers[stop]?.status === 'running';
  const extra = getPhaseControls(stop);

  return (
    <div class="facilitator-controls row" role="group" aria-label={texts.flow.controlsLabel}>
      <button type="button" disabled={prev(stop) === stop} onClick={() => app.flowIntent('flow.prev')}>
        {texts.flow.previous}
      </button>
      <button
        type="button"
        class="primary"
        disabled={next(stop) === stop}
        onClick={() => app.flowIntent('flow.next')}
      >
        {texts.flow.next}
      </button>
      {revealKey && (
        <button
          type="button"
          disabled={flow.revealed[revealKey]}
          onClick={() => app.flowIntent('flow.reveal', { key: revealKey })}
        >
          {texts.flow.reveal}
        </button>
      )}
      {running ? (
        <button type="button" onClick={() => app.flowIntent('flow.timer', { action: 'pause' })}>
          {texts.flow.pauseTimer}
        </button>
      ) : (
        <button type="button" onClick={() => app.flowIntent('flow.timer', { action: 'start' })}>
          {texts.flow.startTimer}
        </button>
      )}
      <button type="button" onClick={() => app.flowIntent('flow.timer', { action: 'reset' })}>
        {texts.flow.resetTimer}
      </button>
      {extra.map((Extra, i) => (
        <Extra
          key={i}
          stop={stop}
          state={state}
          isFacilitator
          revealed={revealKey ? flow.revealed[revealKey] : false}
        />
      ))}
    </div>
  );
}
