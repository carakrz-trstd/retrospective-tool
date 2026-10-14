import { useApp } from '../app/context';
import { texts } from '../texts';

export function RemovedPage() {
  const app = useApp();
  return (
    <div class="page">
      <h2>{texts.removedHeading}</h2>
      <p role="alert">{texts.removedText}</p>
      <button type="button" class="primary" onClick={() => app.goHome()}>
        {texts.toHome}
      </button>
    </div>
  );
}
