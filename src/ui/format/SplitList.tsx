import { describeSplit } from '../../formats/describe';
import type { TimeSplit } from '../../formats/schema';
import { texts } from '../../texts';

/** The suggested minutes per phase for one total time. */
export function SplitList(props: { split: TimeSplit; budget: number }) {
  return (
    <div class="split">
      <h4>
        {texts.timeSplitLabel}: {props.budget} {texts.minutesShort}
      </h4>
      <ul>
        {describeSplit(props.split).map((row) => (
          <li key={row.label}>
            {row.label}: {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
