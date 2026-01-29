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
 */

import type { Quality, ReviewResult, Card } from '../types';

/**
 * Calculate the next review interval based on SM-2 algorithm
 */
export function calculateNextReview(
  quality: Quality,
  repetition: number,
  easeFactor: number,
  interval: number
): ReviewResult {
  // If quality < 3, reset repetitions
  if (quality < 3) {
    return {
      interval: 1,
      repetition: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
    };
  }

  // Calculate new ease factor
  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate new interval
  let newInterval: number;
  if (repetition === 0) {
    newInterval = 1;
  } else if (repetition === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEaseFactor);
  }

  return {
    interval: newInterval,
    repetition: repetition + 1,
    easeFactor: newEaseFactor,
  };
}

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

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + result.interval);

  return {
    ...card,
    interval: result.interval,
    repetition: result.repetition,
    easeFactor: result.easeFactor,
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

export function createCard(
  id: string,
  deckId: string,
  front: string,
  back: string,
  type: CardType = 'flashcard',
  options?: { correctAnswer?: boolean; options?: CardOption[] }
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
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: now, // Due immediately
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
