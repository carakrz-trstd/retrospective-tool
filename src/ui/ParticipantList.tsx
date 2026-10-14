import { useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { texts } from '../texts';
import { ConfirmDialog } from './ConfirmDialog';

/** Everybody in the session with role and online status; the Facilitator can remove people. */
export function ParticipantList() {
  const app = useApp();
  const state = app.state.value;
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  if (!state) return null;
  const me = app.myParticipantId.value;
  const isHost = app.role.value === 'host';
  const people = Object.values(state.participants)
    .filter((p) => p.status === 'active')
    .sort((a, b) => Number(b.isFacilitator) - Number(a.isFacilitator) || a.joinedAt - b.joinedAt);

  return (
    <section aria-labelledby="participants-heading">
      <h2 id="participants-heading">
        {texts.participantsHeading} ({people.length})
      </h2>
      <ul class="participants">
        {people.map((p) => (
          <li key={p.id} data-presence={p.presence}>
            <span class="who">
              <strong>{p.displayName}</strong> <span class="role">{p.role}</span>
              {p.isFacilitator && <span class="badge">{texts.facilitatorBadge}</span>}
              {p.id === me && <span class="badge subtle">{texts.you}</span>}
            </span>
            <span class={`presence ${p.presence}`}>
              {p.presence === 'online' ? texts.online : texts.offline}
            </span>
            {isHost && p.id !== me && (
              <button
                type="button"
                aria-label={`${texts.removeParticipant} ${p.displayName}`}
                onClick={() => setRemoving({ id: p.id, name: p.displayName })}
              >
                {texts.removeParticipant}
              </button>
            )}
          </li>
        ))}
      </ul>
      {removing && (
        <ConfirmDialog
          title={texts.removeTitle}
          confirmLabel={texts.removeAction}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            app.removeParticipant(removing.id);
            setRemoving(null);
          }}
        >
          <p>{texts.removeConfirm(removing.name)}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
