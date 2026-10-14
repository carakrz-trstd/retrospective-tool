import { texts } from '../texts';

export function InternalNotice() {
  return (
    <footer class="internal-notice" role="contentinfo">
      <p>{texts.internalNotice}</p>
      <p>{texts.formatCredit}</p>
    </footer>
  );
}
