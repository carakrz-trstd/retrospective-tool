import { Icon, type IconName } from './Icon';

/** "Nothing here yet": a quiet icon and one short line. Kept outside of lists, so a list stays empty. */
export function EmptyState(props: { icon: IconName; text: string }) {
  return (
    <p class="empty-state">
      <Icon name={props.icon} />
      <span>{props.text}</span>
    </p>
  );
}
