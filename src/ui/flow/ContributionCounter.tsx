import { useApp } from '../../app/context';
import type { StopId } from '../../flow/types';
import { texts } from '../../texts';

/** "5 of 7 have added something" in the write steps; only the Facilitator's view carries the counts. */
export function ContributionCounter(props: { stop: StopId }) {
  const app = useApp();
  const key = props.stop === 'checkIn' ? 'checkIn' : props.stop === 'retro.write' ? 'retro' : null;
  if (!key) return null;
  const counts = app.flowCounts()[key];
  if (!counts) return null;
  return (
    <p class="contribution-counter" role="status">
      {texts.flow.counter(counts.added, counts.total)}
    </p>
  );
}
