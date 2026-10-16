import { useApp } from '../app/context';
import { texts } from '../texts';
import { EndSessionControl } from './EndSessionControl';
import { FlowMain, FlowSide } from './flow/FlowShell';
import { ParticipantList } from './ParticipantList';

/** Wide enough to show the session panel next to the step (it is a collapsible menu on a phone). */
function isWide(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 900px)').matches;
}

/**
 * The running session: one page for the current step, and a session panel (overview of all steps,
 * people, sound, end or leave) beside it on wide screens or in a menu on a phone.
 */
export function SessionShell() {
  const app = useApp();
  const state = app.state.value;
  if (!state) return <p role="status">{texts.connecting}</p>;
  const isHost = app.role.value === 'host';

  return (
    <div class="page session-shell">
      <div class="session-layout">
        <div class="session-main">
          <header class="session-header">
            <h2>{state.title ? `${texts.sessionHeading}: ${state.title}` : texts.sessionHeading}</h2>
            <p class="hint">
              {state.format.name} · {state.timeBudgetMin} min
            </p>
          </header>
          <FlowMain />
        </div>
        <details class="session-side" open={isWide()}>
          <summary>{texts.flow.sessionMenu}</summary>
          <div class="session-side-body">
            <FlowSide />
            <ParticipantList />
            <div class="row">
              {isHost ? (
                <EndSessionControl />
              ) : (
                <button type="button" onClick={() => app.leave()}>
                  {texts.leaveSession}
                </button>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
