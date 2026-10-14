import { useApp } from '../app/context';
import { texts } from '../texts';
import { PersonForm } from './PersonForm';

export function CreateSessionPage() {
  const app = useApp();
  const chosen = app.flow.chosen.value;
  return (
    <div class="page">
      <h2>{texts.createSession}</h2>
      {chosen && (
        <section class="chosen-format" aria-labelledby="chosen-format-heading">
          <h3 id="chosen-format-heading">{texts.chosenFormat}</h3>
          <p>
            <strong>{chosen.format.name}</strong> · {chosen.timeBudgetMin} {texts.minutesShort}
          </p>
          <p class="hint">
            {texts.columnsLabel}: {chosen.format.columns.map((c) => c.name).join(' · ')}
          </p>
          <button type="button" class="link" onClick={() => app.goNew()}>
            {texts.changeFormat}
          </button>
        </section>
      )}
      <PersonForm
        withTitle
        submitLabel={texts.createButton}
        busyLabel={texts.creating}
        onSubmit={({ name, role, title }) => void app.createSession({ name, role, title })}
      />
    </div>
  );
}
