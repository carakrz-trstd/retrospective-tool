import { useApp } from '../app/context';
import { texts } from '../texts';
import { CopyField } from './CopyField';
import { EndSessionControl } from './EndSessionControl';
import { ParticipantList } from './ParticipantList';

const SOFT_LIMIT = 8;

export function LobbyPage() {
  const app = useApp();
  const state = app.state.value;
  const isHost = app.role.value === 'host';
  if (!state) return <p role="status">{texts.connecting}</p>;
  const invitation = app.invitation();
  const activeCount = Object.values(state.participants).filter((p) => p.status === 'active').length;

  return (
    <div class="page">
      <h2>{state.title ? `${texts.lobbyHeading}: ${state.title}` : texts.lobbyHeading}</h2>
      {isHost && invitation && (
        <section aria-labelledby="share-heading">
          <h3 id="share-heading">{texts.shareHeading}</h3>
          <CopyField label={texts.joinLink} value={invitation.link} copyLabel="Copy join link" />
          <CopyField label={texts.joinCode} value={invitation.code} copyLabel="Copy join code" />
        </section>
      )}
      <ParticipantList />
      {isHost && activeCount > SOFT_LIMIT && (
        <p class="banner warn" role="status" data-testid="too-many-warning">
          {texts.tooManyWarning}
        </p>
      )}
      {isHost ? (
        <div class="row">
          <button
            type="button"
            class="primary"
            onClick={() => app.startSession()}
            disabled={app.connection.value.readOnly}
          >
            {texts.startSession}
          </button>
          <EndSessionControl />
        </div>
      ) : (
        <div>
          <p role="status">{texts.waitingForStart}</p>
          <button type="button" onClick={() => app.leave()}>
            {texts.leaveSession}
          </button>
        </div>
      )}
    </div>
  );
}
