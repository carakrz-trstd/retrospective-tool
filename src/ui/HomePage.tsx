import { useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { texts } from '../texts';

function when(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function HomePage() {
  const app = useApp();
  const [code, setCode] = useState('');
  const hosts = app.hostOffers.value;
  const rejoins = app.rejoinOffers.value;

  return (
    <div class="page">
      <p class="intro">{texts.homeIntro}</p>
      {!app.storageOk.value && (
        <p class="banner warn" role="status">
          {texts.storageUnavailable}
        </p>
      )}

      <section aria-labelledby="create-heading">
        <h2 id="create-heading">{texts.createSession}</h2>
        <button type="button" class="primary" onClick={() => app.goCreate()}>
          {texts.createSession}
        </button>
      </section>

      <section aria-labelledby="join-heading">
        <h2 id="join-heading">{texts.joinHeading}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            app.goJoin(code.trim());
          }}
        >
          <label for="home-join-code">{texts.joinCodeLabel}</label>
          <div class="row">
            <input
              id="home-join-code"
              type="text"
              autocomplete="off"
              autocapitalize="characters"
              value={code}
              onInput={(e) => setCode(e.currentTarget.value)}
            />
            <button type="submit">{texts.joinButton}</button>
          </div>
        </form>
      </section>

      {(hosts.length > 0 || rejoins.length > 0) && (
        <section aria-labelledby="offers-heading">
          <h2 id="offers-heading">{texts.resumeHeading}</h2>
          <ul class="offers">
            {hosts.map((o) => (
              <li key={`h-${o.sessionId}`}>
                <span>
                  <strong>{o.title ?? 'Retrospective'}</strong> · {texts.joinCode} {o.joinCode} ·{' '}
                  {o.participants} · {when(o.savedAt)}
                </span>
                <button type="button" class="primary" onClick={() => void app.resume(o.sessionId)}>
                  {texts.resumeSession}
                </button>
                <button type="button" onClick={() => app.discardOffer(o.sessionId)}>
                  {texts.deleteSession}
                </button>
              </li>
            ))}
            {rejoins.map((o) => (
              <li key={`p-${o.sessionId}`}>
                <span>
                  {o.name} ({o.role}) · {when(o.savedAt)}
                </span>
                <button type="button" class="primary" onClick={() => app.rejoin(o.sessionId)}>
                  {texts.rejoinSession}
                </button>
                <button type="button" onClick={() => app.discardOffer(o.sessionId)}>
                  {texts.deleteSession}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {app.formError.value && (
        <p class="error" role="alert">
          {app.formError.value}
        </p>
      )}
    </div>
  );
}
