import { getPhaseTexts } from '../../flow/data/schema';

/** The reminder to open the documentation of the last retro. Nothing is stored or imported here. */
export function ReviewActionsPanel() {
  const phase = getPhaseTexts().phases.find((p) => p.id === 'reviewActions')!;
  return (
    <section class="review-actions" aria-label={phase.title}>
      <p>{phase.oneLine}</p>
    </section>
  );
}
