import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../../app/context';
import type { AppController } from '../../app/AppController';
import { getPhaseView } from '../../flow/registries';
import { stopToPhase } from '../../flow/stops';
import { shouldPlay } from '../../flow/sound';
import { TimerWatcher } from '../../flow/watcher';
import { texts } from '../../texts';
import { ContributionCounter } from './ContributionCounter';
import { FacilitatorControls } from './FacilitatorControls';
import { FacilitatorGuide } from './FacilitatorGuide';
import { PhasePanel } from './PhasePanel';
import { ProgressOverview } from './ProgressOverview';
import { ReviewActionsPanel } from './ReviewActionsPanel';
import { SoundControls } from './SoundControls';
import { StepHeader, StepNav } from './StepNav';
import { TimerWidget } from './TimerWidget';

/** Calls the beep once when the running timer of the current stop reaches zero (unless muted). */
function useTimerWatcher(app: AppController, flow: ReturnType<AppController['flowState']>): void {
  const watcher = useRef<TimerWatcher | undefined>(undefined);
  useEffect(() => {
    const w = new TimerWatcher({
      hostNow: () => app.clock.hostNow(),
      durationOf: (stop) => app.stopDuration(stop),
      onOver: () => {
        if (shouldPlay(app.flowState(), app.localMuted.value)) app.sound.beep();
      },
    });
    watcher.current = w;
    return () => w.dispose();
  }, [app]);
  useEffect(() => {
    watcher.current?.update(flow);
  });
}

/** The page of the current step: where we are, the instruction, the timer, the work, and the way to the neighbouring steps. */
export function FlowMain() {
  const app = useApp();
  const state = app.state.value;
  const flow = app.flowState();
  useTimerWatcher(app, flow);
  if (!state) return null;

  const isFacilitator = app.role.value === 'host';
  const { stop } = flow;
  const View = getPhaseView(stop);
  const revealKey = stop === 'checkIn' ? 'checkIn' : 'retro';
  const showNote = isFacilitator && app.revealNoteStop.value === stop;

  return (
    <div class="flow-main">
      <StepHeader />
      {/* a new page for each phase; the three retro steps share one page so nothing typed is lost */}
      <div class="step-page" key={stopToPhase(stop)}>
        <PhasePanel stop={stop} isFacilitator={isFacilitator} />
        <TimerWidget />
        {isFacilitator && <ContributionCounter stop={stop} />}
        {isFacilitator && <FacilitatorControls />}
        {showNote && (
          <p class="note" role="status">
            {texts.flow.revealNote}
          </p>
        )}
        <main id="session-content" aria-label="Session content" class="content-area">
          {stop === 'reviewActions' ? (
            <ReviewActionsPanel />
          ) : (
            <View
              stop={stop}
              state={state}
              isFacilitator={isFacilitator}
              revealed={flow.revealed[revealKey]}
            />
          )}
        </main>
      </div>
      <StepNav />
    </div>
  );
}

/** What belongs to the session rather than to one step: the overview of all steps, sound and the guide. */
export function FlowSide() {
  const app = useApp();
  if (!app.state.value) return null;
  const isFacilitator = app.role.value === 'host';
  return (
    <>
      {isFacilitator && <ProgressOverview />}
      <SoundControls isFacilitator={isFacilitator} />
      {isFacilitator && <FacilitatorGuide />}
    </>
  );
}
