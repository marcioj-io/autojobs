// packages\scoring\src\scoreEngine.ts
import type { ScoreInput } from '@autojobs/shared';

const WEIGHTS = {
  keywordMatch: 10,
  negativeKeyword: -25,
  easyApply: 10,
  seniorityMatch: 10
};

export function calculateScore(
  input: ScoreInput
) {
  let score = 0;

  const text = [
    input.title,
    input.description,
    input.location
  ]
    .join(' ')
    .toLowerCase();

  for (const keyword of input.positiveKeywords) {
    if (
      text.includes(
        keyword.toLowerCase()
      )
    ) {
      score += WEIGHTS.keywordMatch;
    }
  }

  for (const keyword of input.negativeKeywords) {
    if (
      text.includes(
        keyword.toLowerCase()
      )
    ) {
      score += WEIGHTS.negativeKeyword;
    }
  }

  if (input.easyApply) {
    score += WEIGHTS.easyApply;
  }

  score +=
    WEIGHTS.seniorityMatch;

  return Math.max(
    0,
    Math.min(score, 100)
  );
}