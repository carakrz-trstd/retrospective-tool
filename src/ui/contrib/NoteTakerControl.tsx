import { useApp } from '../../app/context';
import { getContribView } from '../../contrib/types';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { activeParticipants } from './names';

/** The Facilitator marks one participant as note taker (a label; anyone can still write). */
export function NoteTakerControl(props: PhaseViewProps) {
  const app = useApp();
  const current = getContribView(props.state).noteTakerId ?? '';
  return (
    <label class="note-taker-control">
      {texts.contrib.noteTakerSelect}
      <select
        value={current}
        onChange={(e) => app.sendIntent('note.taker', { participantId: e.currentTarget.value || null })}
      >
        <option value="">{texts.contrib.noteTakerNone}</option>
        {activeParticipants(props.state).map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
