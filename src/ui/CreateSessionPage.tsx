import { useApp } from '../app/context';
import { texts } from '../texts';
import { PersonForm } from './PersonForm';

export function CreateSessionPage() {
  const app = useApp();
  return (
    <div class="page">
      <h2>{texts.createSession}</h2>
      <PersonForm
        withTitle
        submitLabel={texts.createButton}
        busyLabel={texts.creating}
        onSubmit={({ name, role, title }) => void app.createSession({ name, role, title })}
      >
        <p class="hint">{texts.formatNote}</p>
      </PersonForm>
    </div>
  );
}
