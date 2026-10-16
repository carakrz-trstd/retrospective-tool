import { useApp } from '../../app/context';
import { getContribView } from '../../contrib/types';
import { createUuid } from '../../core/ids';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { EntryComposer } from './EntryComposer';
import { EntryList } from './EntryList';
import { RejectedNotice } from './RejectedNotice';

/** Check-in: the format's question, one response per participant, the revealed responses with names. */
export function CheckInView(props: PhaseViewProps) {
  const app = useApp();
  const me = app.myParticipantId.value;
  const entries = Object.values(getContribView(props.state).entries).filter((e) => e.kind === 'checkIn');
  const answered = entries.some((e) => e.authorId === me);
  return (
    <section class="contrib-checkin" aria-label="Check-in">
      <RejectedNotice />
      <p class="check-in-question">{props.state.format.checkInQuestion}</p>
      {!answered && (
        <EntryComposer
          fieldLabel={texts.contrib.responseField}
          addLabel={texts.contrib.addResponse}
          onAdd={(text) => app.sendIntent('entry.add', { id: createUuid(), kind: 'checkIn', text })}
        />
      )}
      {!props.revealed && <p class="hint">{texts.contrib.hiddenHint}</p>}
      <EntryList
        entries={entries}
        state={props.state}
        isFacilitator={props.isFacilitator}
        label="Responses"
        emptyText={texts.contrib.noResponses}
        emptyIcon="chat"
      />
    </section>
  );
}
