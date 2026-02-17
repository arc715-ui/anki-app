/**
 * SM-2 (SuperMemo 2) Spaced Repetition Algorithm
 *
 * Quality ratings:
 * 0 - Complete blackout, no recall at all
 * 1 - Incorrect response, but recognized the answer
 * 2 - Incorrect response, but answer was easy to recall after seeing it
 * 3 - Correct response with serious difficulty
 * 4 - Correct response after hesitation
 * 5 - Perfect response with no hesitation
 *
 * Intervals < 1 are sub-day (in fractions of a day):
 *   1 minute  = 1/1440
 *   10 minutes = 10/1440
 */

import type { Quality, ReviewResult, Card } from '../types';

const MINUTES_PER_DAY = 24 * 60; // 1440

/**
 * Calculate the next review interval based on SM-2 algorithm
 * with Anki-style learning steps (sub-day intervals for new/failed cards)
 */
export function calculateNextReview(
  quality: Quality,
  repetition: number,
  easeFactor: number,
  interval: number
): ReviewResult {
  // Again (quality 0-1): 1 minute, reset to step 0
  if (quality < 2) {
    return {
      interval: 1 / MINUTES_PER_DAY,
      repetition: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
    };
  }

  // Hard-fail (quality 2): 10 minutes, reset to step 1
  if (quality === 2) {
    return {
      interval: 10 / MINUTES_PER_DAY,
      repetition: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.1),
    };
  }

  // Calculate new ease factor
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Learning phase: new card (rep=0) or sub-day interval
  // Step 0: interval < 5min (new or just failed)
  // Step 1: interval >= 5min but < 1 day (passed step 0)
  const isLearning = repetition === 0 || interval < 1;
  const isStep0 = isLearning && interval < 5 / MINUTES_PER_DAY;

  let newInterval: number;
  let newRepetition: number;

  if (isLearning && isStep0) {
    // Step 0 (1min): Good advances to step 1, Easy graduates
    if (quality === 3) {
      newInterval = 1 / MINUTES_PER_DAY;   // Hard: repeat step 0 (1min)
      newRepetition = 0;
    } else if (quality === 5) {
      newInterval = 4;                       // Easy: graduate to 4 days
      newRepetition = 1;
    } else {
      newInterval = 10 / MINUTES_PER_DAY;   // Good: advance to step 1 (10min)
      newRepetition = 0;
    }
  } else if (isLearning) {
    // Step 1 (10min): Good graduates to 1 day, Easy to 4 days
    if (quality === 3) {
      newInterval = 10 / MINUTES_PER_DAY;   // Hard: repeat step 1 (10min)
      newRepetition = 0;
    } else if (quality === 5) {
      newInterval = 4;                       // Easy: graduate to 4 days
      newRepetition = 1;
    } else {
      newInterval = 1;                       // Good: graduate to 1 day
      newRepetition = 1;
    }
  } else if (repetition === 1) {
    // First review after graduation — use EF-based scaling (like Anki)
    if (quality === 3) {
      newInterval = Math.max(1, interval);
    } else if (quality === 5) {
      // Easy bonus: EF * 3 (e.g. 4d * 2.5 * 3 = 30d ≈ 1ヶ月)
      newInterval = Math.max(interval + 1, Math.round(interval * newEaseFactor * 3));
    } else {
      // Good: EF scaling with min 4 days (e.g. 1d * 2.5 → 4d)
      newInterval = Math.max(4, Math.round(interval * newEaseFactor));
    }
    newRepetition = repetition + 1;
  } else {
    // Mature card (rep >= 2) — standard SM-2 with Easy bonus
    if (quality === 3) {
      newInterval = Math.max(interval, Math.round(interval * 1.2));
    } else if (quality === 5) {
      // Easy bonus: EF * 1.3
      newInterval = Math.max(interval + 1, Math.round(interval * newEaseFactor * 1.3));
    } else {
      newInterval = Math.max(interval + 1, Math.round(interval * newEaseFactor));
    }
    newRepetition = repetition + 1;
  }

  return {
    interval: newInterval,
    repetition: newRepetition,
    easeFactor: newEaseFactor,
  };
}

/**
 * Lapse recovery: when a graduated card fails and re-graduates,
 * the new interval is a percentage of the pre-lapse interval (not a full reset).
 * 50% means a 30-day card → lapse → re-graduate at 15 days.
 */
const LAPSE_NEW_INTERVAL_PERCENT = 0.5;

/**
 * Apply review result to a card and return updated card
 */
export function reviewCard(card: Card, quality: Quality): Card {
  const result = calculateNextReview(
    quality,
    card.repetition,
    card.easeFactor,
    card.interval
  );

  let newInterval = result.interval;
  let lapseInterval: number | undefined = card.lapseInterval;

  // Track lapse: graduated card fails → save pre-lapse interval
  if (quality < 3 && card.interval >= 1 && card.repetition >= 1) {
    lapseInterval = card.interval;
  }

  // Lapse recovery: graduating from relearning → use % of old interval
  if (lapseInterval != null && newInterval >= 1 && result.repetition >= 1) {
    const recoveryInterval = Math.max(1, Math.round(lapseInterval * LAPSE_NEW_INTERVAL_PERCENT));
    newInterval = Math.max(recoveryInterval, newInterval);
    lapseInterval = undefined; // Graduated, clear lapse tracking
  }

  const nextReviewDate = new Date();
  if (newInterval < 1) {
    // Sub-day interval: add minutes
    const minutes = Math.round(newInterval * MINUTES_PER_DAY);
    nextReviewDate.setTime(nextReviewDate.getTime() + minutes * 60 * 1000);
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  }

  return {
    ...card,
    interval: newInterval,
    repetition: result.repetition,
    easeFactor: result.easeFactor,
    lapseInterval,
    nextReview: nextReviewDate.toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if a card is due for review
 */
export function isDue(card: Card): boolean {
  return new Date(card.nextReview) <= new Date();
}

/**
 * Get cards that are due for review from a list
 */
export function getDueCards(cards: Card[]): Card[] {
  return cards.filter(isDue).sort(
    (a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime()
  );
}

/**
 * Create a new card with default SM-2 values
 */
import type { CardType, CardOption } from '../types';

function calculateInitialEaseFactor(correctRate?: number): number {
  if (correctRate == null) return 2.5;
  if (correctRate >= 80) return 2.7;
  if (correctRate >= 60) return 2.5;
  if (correctRate >= 40) return 2.3;
  return 2.0;
}

export function createCard(
  id: string,
  deckId: string,
  front: string,
  back: string,
  type: CardType = 'flashcard',
  options?: { correctAnswer?: boolean; options?: CardOption[]; difficulty?: string; correctRate?: number; source?: string; point?: string; subject?: string; subCategory?: string }
): Card {
  const now = new Date().toISOString();
  return {
    id,
    deckId,
    type,
    front,
    back,
    correctAnswer: options?.correctAnswer,
    options: options?.options,
    difficulty: options?.difficulty,
    correctRate: options?.correctRate,
    source: options?.source,
    point: options?.point,
    subject: options?.subject,
    subCategory: options?.subCategory,
    interval: 0,
    repetition: 0,
    easeFactor: calculateInitialEaseFactor(options?.correctRate),
    nextReview: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get quality rating label in Japanese
 */
export function getQualityLabel(quality: Quality): string {
  const labels: Record<Quality, string> = {
    0: '全く分からない',
    1: '間違えた',
    2: 'かろうじて',
    3: '難しい',
    4: '普通',
    5: '完璧！',
  };
  return labels[quality];
}
