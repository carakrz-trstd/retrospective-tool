import { texts } from '../texts';
import { getOfflineHintActions } from './bannerActions';
import { useApp } from './context';

/** Always shows the connection state (NFR-6): connecting, reconnecting, Facilitator offline. */
export function ConnectionBanner() {
  const app = useApp();
  const c = app.connection.value;
  const role = app.role.value;
  const sessionId = app.state.value?.sessionId;

  let message = '';
  let tone: 'info' | 'warn' = 'info';
  if (role === 'host') {
    if (c.readOnly) {
      message = texts.takenOverNotice;
      tone = 'warn';
    } else if (c.hostWaiting) {
      message = texts.hostWaiting;
      tone = 'warn';
    }
  } else if (role === 'participant') {
    if (c.status === 'connecting') message = texts.connecting;
    else if (c.status === 'reconnecting') {
      message = texts.reconnecting;
      tone = 'warn';
    } else if (c.status === 'facilitator-offline') {
      message = texts.facilitatorOffline;
      tone = 'warn';
    }
  }
  if (!message && !(role === 'participant' && c.longOffline)) return null;

  return (
    <div class={`banner ${tone}`} role="status" aria-live="polite" data-testid="connection-banner">
      {message && <p>{message}</p>}
      {role === 'participant' && c.longOffline && (
        <div data-testid="long-offline-hint">
          <p>{texts.longOfflineHint}</p>
          <button type="button" onClick={() => app.leave()}>
            {texts.leaveSession}
          </button>
          {getOfflineHintActions().map((Action, i) => (
            <Action key={i} />
          ))}
        </div>
      )}
      {role === 'host' && c.readOnly && sessionId && (
        <button type="button" onClick={() => void app.resume(sessionId)}>
          {texts.takeOver}
        </button>
      )}
    </div>
  );
}
