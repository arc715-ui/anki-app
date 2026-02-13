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
  // Exam metadata (optional, from import)
  difficulty?: string;     // e.g. "レベル：3 （正解率：67.5％）"
  correctRate?: number;    // Numeric correct rate e.g. 67.5
  source?: string;         // Legal source reference
  point?: string;          // Key learning point
  subject?: string;        // Subject/category (e.g. "労基/安衛", "基礎法学")
  subCategory?: string;    // Sub-category (e.g. "裁判制度", "安全衛生管理体制")
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

// Multi-exam support
export interface Exam {
  id: string;
  name: string;               // e.g. "社労士"
  shortName: string;           // e.g. "社労士" (compact display)
  examDate: string;            // "YYYY-MM-DD"
  deckPattern: string;         // deck.name.includes() matching
  weight: number;              // manual weight multiplier (default 1.0)
  prioritySubjects: string[];  // subjects to study more often
  color: string;               // UI accent color
}

export interface ExamStats {
  examId: string;
  daysLeft: number;
  totalCards: number;
  masteredCards: number;
  dueCards: number;
  dailyQuota: number;
}

