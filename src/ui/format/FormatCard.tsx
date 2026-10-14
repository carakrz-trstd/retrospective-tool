import type { ComponentChildren } from 'preact';
import { formatTags } from '../../formats/describe';
import { timeSplitFor } from '../../formats/library';
import type { Format } from '../../formats/schema';
import type { TimeBudget } from '../../formats/types';
import { texts } from '../../texts';
import { SplitList } from './SplitList';

/** One format as a card: name, description, columns, tags, optional reasons and time split. */
export function FormatCard(props: {
  format: Format;
  badge?: string;
  reasons?: string[];
  budget?: TimeBudget;
  big?: boolean;
  actions: ComponentChildren;
}) {
  const f = props.format;
  const tags = formatTags(f);
  const headingId = `card-${f.id}`;
  const split = props.budget ? timeSplitFor(f, props.budget) : undefined;
  return (
    <article class={`format-card${props.big ? ' big' : ''}`} aria-labelledby={headingId}>
      <header>
        {props.badge && <span class="badge">{props.badge}</span>}
        <h3 id={headingId}>{f.name}</h3>
      </header>
      <p>{f.description}</p>
      <p class="hint">
        {texts.columnsLabel}: {f.columns.map((c) => c.name).join(' · ')}
      </p>
      {props.reasons && props.reasons.length > 0 && (
        <div>
          <h4>{texts.whyItFits}</h4>
          <ul>
            {props.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {!props.reasons && (
        <p class="hint tags">
          {tags.mood.length > 0 && `${texts.tags.mood}: ${tags.mood.join(', ')} · `}
          {tags.goal.length > 0 && `${texts.tags.goal}: ${tags.goal.join(', ')} · `}
          {tags.depth.length > 0 && `${texts.tags.depth}: ${tags.depth.join(', ')} · `}
          {tags.setting.length > 0 && `${texts.tags.setting}: ${tags.setting.join(', ')} · `}
          {texts.supportedTimes} {tags.durations.join(', ')} {texts.minutesShort}
        </p>
      )}
      {split && props.budget && <SplitList split={split} budget={props.budget} />}
      <div class="row">{props.actions}</div>
    </article>
  );
}
