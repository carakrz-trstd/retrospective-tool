import { useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { isValidJoinCode } from '../core/ids';
import { targetFromInput } from '../app/router';
import { texts } from '../texts';
import { PersonForm } from './PersonForm';

export function JoinPage() {
  const app = useApp();
  const [typed, setTyped] = useState('');
  const preset = app.joinTarget.value;
  const target = preset || targetFromInput(typed);

  return (
    <div class="page">
      <h2>{texts.joinHeading}</h2>
      {preset ? (
        <p class="hint">
          {isValidJoinCode(preset) ? `${texts.joinCode}: ${preset.toUpperCase()}` : texts.joiningViaLink}
        </p>
      ) : (
        <div>
          <label for="join-target">{texts.joinCodeLabel}</label>
          <input
            id="join-target"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            value={typed}
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
        </div>
      )}
      <PersonForm
        submitLabel={texts.joinButton}
        busyLabel={texts.joining}
        onSubmit={({ name, role }) => void app.join(target, name, role)}
      />
    </div>
  );
}
