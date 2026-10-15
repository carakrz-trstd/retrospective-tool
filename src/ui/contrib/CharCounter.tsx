import { length } from '../../contrib/limits';
import { texts } from '../../texts';

/** "123 characters left" for a text field with a limit. */
export function CharCounter(props: { text: string; max: number }) {
  return (
    <p class="char-counter hint" aria-live="polite">
      {texts.contrib.charsLeft(Math.max(0, props.max - length(props.text)))}
    </p>
  );
}
