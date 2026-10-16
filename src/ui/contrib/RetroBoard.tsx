import { useApp } from '../../app/context';
import { getContribView } from '../../contrib/types';
import { createUuid } from '../../core/ids';
import type { PhaseViewProps } from '../../flow/registries';
import { texts } from '../../texts';
import { EntryComposer } from './EntryComposer';
import { EntryList } from './EntryList';
import { RejectedNotice } from './RejectedNotice';

/** The board: one column per column of the chosen format, stacked on narrow screens. */
export function RetroBoard(props: PhaseViewProps) {
  const app = useApp();
  const entries = Object.values(getContribView(props.state).entries).filter((e) => e.kind === 'retro');
  return (
    <section class="contrib-retro" aria-label="Retrospective board">
      <RejectedNotice />
      {!props.revealed && <p class="hint">{texts.contrib.hiddenHint}</p>}
      <div class="retro-board">
        {props.state.format.columns.map((col, index) => (
          <section class="retro-column" data-color={index % 5} key={col.id} aria-labelledby={`col-${col.id}`}>
            <h4 id={`col-${col.id}`}>{col.name}</h4>
            {col.prompt && <p class="hint">{col.prompt}</p>}
            <EntryComposer
              fieldLabel={texts.contrib.entryFor(col.name)}
              addLabel={texts.contrib.addEntryTo(col.name)}
              onAdd={(text) =>
                app.sendIntent('entry.add', { id: createUuid(), kind: 'retro', columnId: col.id, text })
              }
            />
            <EntryList
              entries={entries.filter((e) => e.columnId === col.id)}
              state={props.state}
              isFacilitator={props.isFacilitator}
              label={col.name}
            />
          </section>
        ))}
      </div>
    </section>
  );
}
