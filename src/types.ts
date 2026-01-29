// Card data types for the Anki-style flashcard app

// Card types
export type CardType = 'flashcard' | 'true_false' | 'multiple_choice';

// Option for multiple choice questions
export interface CardOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Card {
  id: string;
  deckId: string;
  type: CardType;        // Card type
  front: string;         // Question
  back: string;          // Answer (for flashcard type)
  // For true_false type
  correctAnswer?: boolean;
  // For multiple_choice type
  options?: CardOption[];
  // SM-2 algorithm fields
  interval: number;      // Days until next review
  repetition: number;    // Number of consecutive correct answers
  easeFactor: number;    // Ease factor (starts at 2.5)
  nextReview: string;    // ISO date string for next review
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;         // Theme color for the deck
  createdAt: string;
}

export interface StudySession {
  id: string;
  deckId: string;
  cardsStudied: number;
  correctCount: number;
  date: string;
}

export interface StudyStats {
  totalCards: number;
  cardsStudiedToday: number;
  streak: number;
  lastStudyDate: string | null;
}

// SM-2 quality ratings
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewResult {
  interval: number;
  repetition: number;
  easeFactor: number;
}

