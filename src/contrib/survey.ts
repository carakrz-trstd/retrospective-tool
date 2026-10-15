// Rules of the anonymous exit survey and the aggregation of its answers.
import { COMMENT_MAX, validateText } from './limits';
import { fail, type Rating, type RuleContext, type RuleResult, type SurveyAnswer } from './types';

const isRating = (v: unknown): v is Rating =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

function comment(v: unknown): { ok: true; text?: string } | { ok: false; reason: string } {
  if (v === undefined || v === null) return { ok: true };
  if (typeof v !== 'string') return { ok: false, reason: 'invalid-answer' };
  const t = validateText(v, COMMENT_MAX);
  if (t.ok) return { ok: true, text: t.text };
  return t.reason === 'empty' ? { ok: true } : { ok: false, reason: t.reason };
}

export function submitSurvey(c: RuleContext): RuleResult {
  if (c.contrib.survey.closed || c.state.status !== 'running') return fail('survey-closed');
  const key = c.payload.answerKey;
  const raw = c.payload.answer as Record<string, unknown> | null | undefined;
  if (typeof key !== 'string' || key.length === 0 || key.length > 100) return fail('invalid');
  if (!raw || typeof raw !== 'object') return fail('invalid-answer');
  if (!isRating(raw.retroRating) || !isRating(raw.toolRating)) return fail('invalid-answer');
  const retro = comment(raw.retroComment);
  if (!retro.ok) return fail(retro.reason);
  const tool = comment(raw.toolComment);
  if (!tool.ok) return fail(tool.reason);
  const answer: SurveyAnswer = {
    retroRating: raw.retroRating,
    ...(retro.text ? { retroComment: retro.text } : {}),
    toolRating: raw.toolRating,
    ...(tool.text ? { toolComment: tool.text } : {}),
  };
  const survey = { ...c.contrib.survey, answers: { ...c.contrib.survey.answers, [key]: answer } };
  return { ok: true, contrib: { ...c.contrib, survey } };
}

export function closeSurvey(c: RuleContext): RuleResult {
  if (c.contrib.survey.closed) return { ok: true, contrib: c.contrib };
  return { ok: true, contrib: { ...c.contrib, survey: { ...c.contrib.survey, closed: true } } };
}

export interface QuestionResult {
  /** One decimal, or null without answers. */
  average: number | null;
  /** How many gave 1, 2, 3, 4 and 5. */
  distribution: [number, number, number, number, number];
  /** Comments without names, in the order of the answers given. */
  comments: string[];
}

export interface SurveyResults {
  count: number;
  retro: QuestionResult;
  tool: QuestionResult;
}

function question(
  answers: SurveyAnswer[],
  rating: (a: SurveyAnswer) => Rating,
  text: (a: SurveyAnswer) => string | undefined,
): QuestionResult {
  const distribution: QuestionResult['distribution'] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const a of answers) {
    distribution[rating(a) - 1]! += 1;
    sum += rating(a);
  }
  return {
    average: answers.length ? Math.round((sum / answers.length) * 10) / 10 : null,
    distribution,
    comments: answers.map(text).filter((t): t is string => !!t),
  };
}

export function aggregate(answers: SurveyAnswer[]): SurveyResults {
  return {
    count: answers.length,
    retro: question(
      answers,
      (a) => a.retroRating,
      (a) => a.retroComment,
    ),
    tool: question(
      answers,
      (a) => a.toolRating,
      (a) => a.toolComment,
    ),
  };
}
