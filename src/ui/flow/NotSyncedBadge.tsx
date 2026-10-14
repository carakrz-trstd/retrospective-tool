import { texts } from '../../texts';

export function NotSyncedBadge() {
  return (
    <span class="badge warn" role="status">
      {texts.flow.notSynchronized}
    </span>
  );
}
