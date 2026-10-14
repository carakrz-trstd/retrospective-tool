import { useApp } from '../app/context';
import { texts } from '../texts';
import { EndSessionControl } from './EndSessionControl';
import { ParticipantList } from './ParticipantList';

/** The running session. Later epics render the phases (flow, contributions) in the content area. */
export function SessionShell() {
  const app = useApp();
  const state = app.state.value;
  if (!state) return <p role="status">{texts.connecting}</p>;
  const isHost = app.role.value === 'host';

  return (
    <div class="page session-shell">
      <header class="session-header">
        <h2>{state.title ? `${texts.sessionHeading}: ${state.title}` : texts.sessionHeading}</h2>
        <p class="hint">
          {state.format.name} · {state.timeBudgetMin} min
        </p>
      </header>
      <main id="session-content" aria-label="Session content" class="content-area">
        <p>{texts.sessionPlaceholder}</p>
      </main>
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
  );
}
