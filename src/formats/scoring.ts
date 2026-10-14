// The recommendation: a generic scorer over the weights in the format data. The chosen time is a
// hard filter (a format that cannot fit it is never recommended); the other four answers add up
// to a score, the goal counting with a configurable multiplier.

import type { Format, ScoringConfig } from './schema';
import type { Answers } from './types';

export interface Match {
  format: Format;
  score: number;
  maxScore: number;
  /** One or two short texts: why this format fits the answers. */
  reasons: string[];
  weak: boolean;
}

export interface Recommendation {
  recommended: Match;
  alternatives: Match[];
  /** The best match is only a weak fit for the answers. */
  weak: boolean;
}

type Dimension = 'mood' | 'goal' | 'depth' | 'setting';

const TEMPLATES: Record<Dimension, Record<string, string>> = {
  mood: {
    energized: 'Works well for an energized team',
    neutral: 'Works well for a team in a neutral mood',
    tired: 'Works well for a tired team',
    tense: 'Gentle enough for a tense team',
  },
  goal: {
    fun: 'Good when you want to have fun',
    bond: 'Good when you want to bond as a team',
    'reflect-period': 'Good when you want to reflect on the period since the last retro',
    'reflect-project': 'Good when you want to reflect on a specific project',
  },
  depth: {
    lean: 'Fits a lean session',
    extensive: 'Fits an extensive session with room for discussion',
  },
  setting: {
    'in-room': 'Works well when you are in the same room',
    remote: 'Works well when you meet remotely',
  },
};

function weightsFor(format: Format, answers: Answers): Record<Dimension, number> {
  return {
    mood: format.fit.mood[answers.mood],
    goal: format.fit.goal[answers.goal],
    depth: format.fit.depth[answers.depth],
    setting: format.fit.setting[answers.setting],
  };
}

function reasonText(format: Format, dimension: Dimension, answers: Answers): string {
  if (dimension === 'mood') {
    return format.reasons?.mood?.[answers.mood] ?? TEMPLATES.mood[answers.mood]!;
  }
  if (dimension === 'goal') {
    return format.reasons?.goal?.[answers.goal] ?? TEMPLATES.goal[answers.goal]!;
  }
  return TEMPLATES[dimension][dimension === 'depth' ? answers.depth : answers.setting]!;
}

/** Up to two reasons: the answers this format fits best (weight 2 or more), the goal first. */
function reasonsFor(format: Format, answers: Answers, weights: Record<Dimension, number>): string[] {
  const order: Dimension[] = ['goal', 'mood', 'depth', 'setting'];
  const ranked = order.map((d, i) => ({ d, w: weights[d], i })).sort((a, b) => b.w - a.w || a.i - b.i);
  const strong = ranked.filter((r) => r.w >= 2).slice(0, 2);
  const chosen = strong.length > 0 ? strong : ranked.slice(0, 1); // a weak match still says what fits best
  return chosen.map((r) => reasonText(format, r.d, answers));
}

function budgetKey(answers: Answers): '30' | '50' | '80' {
  return String(answers.timeBudgetMin) as '30' | '50' | '80';
}

export function recommend(answers: Answers, formats: Format[], config: ScoringConfig): Recommendation {
  const candidates = formats.filter((f) => f.timeSplits[budgetKey(answers)] !== undefined);
  if (candidates.length === 0) {
    throw new Error(`No format supports a time of ${answers.timeBudgetMin} minutes`);
  }
  const maxScore = 3 * (1 + config.goalMultiplier + 1 + 1);
  const rank = (id: string) => {
    const i = config.order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const matches: Match[] = candidates.map((format) => {
    const w = weightsFor(format, answers);
    const score = w.mood + config.goalMultiplier * w.goal + w.depth + w.setting;
    return {
      format,
      score,
      maxScore,
      reasons: reasonsFor(format, answers, w),
      weak: maxScore === 0 ? true : score / maxScore < config.weakThreshold,
    };
  });

  matches.sort(
    (a, b) =>
      b.score - a.score || rank(a.format.id) - rank(b.format.id) || a.format.id.localeCompare(b.format.id),
  );

  const [recommended, ...rest] = matches as [Match, ...Match[]];
  return {
    recommended,
    alternatives: rest.slice(0, config.maxAlternatives),
    weak: recommended.weak,
  };
}
