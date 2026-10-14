// The state of the format selection (questionnaire, suggestion, library, custom format). It lives
// in memory only: nothing is stored on the device, so a reload starts again at the questionnaire.

import { createCustomFromLibrary, createCustomFromScratch, validateCustom } from '../../formats/custom';
import { scoringConfig } from '../../formats/defaults';
import { startSessionCreation } from '../../formats/handover';
import { getFormat, listFormats, supports } from '../../formats/library';
import { isComplete } from '../../formats/questionnaire';
import { recommend, type Recommendation } from '../../formats/scoring';
import type { Format } from '../../formats/schema';
import type { Answers, ChosenFormat, TimeBudget } from '../../formats/types';
import { ref } from '../ref';

export type FlowStep = 'questionnaire' | 'recommendation' | 'library' | 'details' | 'custom' | 'time';

export interface FlowDeps {
  /** The choice is made: continue with session creation. */
  onChosen: (chosen: ChosenFormat) => void;
  /** The step changed (the app mirrors it in the address bar). */
  onStep?: (step: FlowStep, formatId?: string) => void;
}

export class FormatFlow {
  readonly step = ref<FlowStep>('questionnaire');
  readonly answers = ref<Partial<Answers>>({});
  /** "Show recommendation" was pressed with missing answers: the missing questions are marked. */
  readonly attempted = ref(false);
  readonly recommendation = ref<Recommendation | null>(null);
  readonly detailsId = ref<string | null>(null);
  /** The custom format being edited. */
  readonly draft = ref<Format | null>(null);
  readonly draftErrors = ref<string[]>([]);
  readonly draftAttempted = ref(false);
  /** A format that waits for the person to pick a time. */
  readonly pending = ref<Format | null>(null);
  readonly chosen = ref<ChosenFormat | null>(null);
  readonly error = ref<string | null>(null);
  private from: 'recommendation' | 'library' | 'questionnaire' = 'questionnaire';

  constructor(private readonly deps: FlowDeps) {}

  /** Starts over (a new session creation). */
  reset(): void {
    this.answers.set({});
    this.attempted.set(false);
    this.recommendation.set(null);
    this.detailsId.set(null);
    this.draft.set(null);
    this.draftErrors.set([]);
    this.draftAttempted.set(false);
    this.pending.set(null);
    this.chosen.set(null);
    this.error.set(null);
    this.from = 'questionnaire';
    this.go('questionnaire');
  }

  private go(step: FlowStep, formatId?: string): void {
    this.step.set(step);
    this.deps.onStep?.(step, formatId);
  }

  /** Called when the address bar points somewhere inside the flow without the data it needs. */
  guard(step: FlowStep): void {
    const needsAnswers = step === 'recommendation' && !isComplete(this.answers.value);
    const needsFormat =
      (step === 'details' && !this.detailsId.value) ||
      (step === 'custom' && !this.draft.value) ||
      (step === 'time' && !this.pending.value);
    this.step.set(needsAnswers || needsFormat ? 'questionnaire' : step);
  }

  setAnswer<K extends keyof Answers>(key: K, value: Answers[K]): void {
    this.answers.set({ ...this.answers.value, [key]: value });
    // the suggestion belongs to the answers it was made for
    this.recommendation.set(null);
  }

  /** Makes the suggestion; with missing answers it marks them instead. */
  showRecommendation(): boolean {
    const a = this.answers.value;
    if (!isComplete(a)) {
      this.attempted.set(true);
      return false;
    }
    this.recommendation.set(recommend(a, listFormats(), scoringConfig));
    this.from = 'recommendation';
    this.go('recommendation');
    return true;
  }

  openLibrary(): void {
    this.from = this.step.value === 'recommendation' ? 'recommendation' : 'library';
    this.go('library');
  }

  openDetails(formatId: string, from: 'recommendation' | 'library'): void {
    this.detailsId.set(formatId);
    this.from = from;
    this.go('details', formatId);
  }

  backFromDetails(): void {
    this.go(this.from === 'recommendation' ? 'recommendation' : 'library');
  }

  backToQuestionnaire(): void {
    this.go('questionnaire');
  }

  /** "Use this format": a library format or a finished custom format. */
  useFormat(format: Format): void {
    this.error.set(null);
    const a = this.answers.value;
    const answered = isComplete(a) ? a : undefined;
    if (answered && supports(format, answered.timeBudgetMin)) {
      this.choose(format, answered.timeBudgetMin);
    } else {
      // no time answer yet, or this format does not fit the time that was chosen
      this.pending.set(format);
      this.go('time');
    }
  }

  chooseTime(budget: TimeBudget): void {
    const format = this.pending.value;
    if (!format) return;
    this.choose(format, budget);
  }

  private choose(format: Format, budget: TimeBudget): void {
    const a = this.answers.value;
    const result = startSessionCreation(
      { format, timeBudgetMin: budget, ...(isComplete(a) ? { answers: a } : {}) },
      (chosen) => {
        this.chosen.set(chosen);
        this.pending.set(null);
        this.deps.onChosen(chosen);
      },
    );
    if (!result.ok) this.error.set(result.reason);
  }

  startCustom(): void {
    this.draft.set(createCustomFromScratch());
    this.draftErrors.set([]);
    this.draftAttempted.set(false);
    this.go('custom');
  }

  /** "Use as basis": a copy of a library format that can be changed freely. */
  useAsBasis(formatId: string): void {
    const library = getFormat(formatId);
    if (!library) return;
    this.draft.set(createCustomFromLibrary(library));
    this.draftErrors.set([]);
    this.draftAttempted.set(false);
    this.go('custom');
  }

  setDraft(format: Format): void {
    this.draft.set(format);
    if (this.draftAttempted.value) this.draftErrors.set(this.errorsOf(format));
  }

  private errorsOf(format: Format): string[] {
    const r = validateCustom(format);
    return r.ok ? [] : r.errors;
  }

  /** "Save and continue": checks the draft and hands it over. */
  saveCustom(): boolean {
    const draft = this.draft.value;
    if (!draft) return false;
    this.draftAttempted.set(true);
    const errors = this.errorsOf(draft);
    this.draftErrors.set(errors);
    if (errors.length > 0) return false;
    this.useFormat(draft);
    return true;
  }
}
