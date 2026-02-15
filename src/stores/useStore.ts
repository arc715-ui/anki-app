import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Card, Deck, StudySession, CardType, CardOption, Quality, Exam, ExamStats, Milestone, WeakPointRecommendation } from '../types';
import { createCard, reviewCard, getDueCards } from '../lib/sm2';
import { deleteDeckRemote, deleteCardsByDeckRemote } from '../lib/syncService';

interface AppState {
  // Data
  decks: Deck[];
  cards: Card[];
  sessions: StudySession[];

  // UI State
  currentDeckId: string | null;
  currentView: 'home' | 'study' | 'edit' | 'stats' | 'import';

  // Streak tracking
  streak: number;
  lastStudyDate: string | null;

  // Multi-exam support
  exams: Exam[];

  // Milestones
  milestones: Milestone[];

  // Weak point recommendations (read-only, from n8n weekly analysis)
  weakPointRecommendations: WeakPointRecommendation[];

  // Actions - Decks
  addDeck: (name: string, description: string, color: string) => string;
  updateDeck: (id: string, updates: Partial<Omit<Deck, 'id' | 'createdAt'>>) => void;
  deleteDeck: (id: string) => void;

  // Actions - Cards
  addCard: (deckId: string, front: string, back: string, type?: CardType, options?: { correctAnswer?: boolean; options?: CardOption[] }) => void;
  updateCard: (id: string, updates: Partial<Pick<Card, 'front' | 'back' | 'correctAnswer' | 'options'>>) => void;
  deleteCard: (id: string) => void;
  reviewCardAction: (cardId: string, quality: Quality) => void;
  importCards: (deckId: string, cards: Array<{ front: string; back: string; type?: CardType; correctAnswer?: boolean; options?: CardOption[]; difficulty?: string; correctRate?: number; source?: string; point?: string; subject?: string; subCategory?: string }>) => void;
  importCardsToMultipleDecks: (baseName: string, color: string, cardsBySubject: Record<string, Array<{ front: string; back: string; type?: CardType; correctAnswer?: boolean; options?: CardOption[]; difficulty?: string; correctRate?: number; source?: string; point?: string; subject?: string; subCategory?: string }>>) => void;

  // Actions - Study
  getDueCardsForDeck: (deckId: string, subjectFilter?: string) => Card[];
  getCardsForDeck: (deckId: string) => Card[];
  getSubjectsForDeck: (deckId: string) => string[];
  recordSession: (deckId: string, cardsStudied: number, correctCount: number) => void;

  // Actions - Navigation
  setCurrentDeck: (deckId: string | null) => void;
  setCurrentView: (view: AppState['currentView']) => void;

  // Actions - Stats
  updateStreak: () => void;
  getTodayStats: () => { cardsStudied: number; correctRate: number };

  // Actions - Multi-exam
  addExam: (exam: Omit<Exam, 'id'>) => void;
  updateExam: (id: string, updates: Partial<Omit<Exam, 'id'>>) => void;
  removeExam: (id: string) => void;
  getDecksForExam: (examId: string) => Deck[];
  getExamStats: () => ExamStats[];
  getTotalDailyQuota: () => number;
  getSmartStudyQueue: () => Card[];

  // Actions - Milestones
  addMilestone: (milestone: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  recordMockExamResult: (id: string, actualScore: number) => void;
  getUpcomingMilestones: (examName?: string) => Milestone[];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      decks: [],
      cards: [],
      sessions: [],
      currentDeckId: null,
      currentView: 'home',
      streak: 0,
      lastStudyDate: null,
      exams: [],
      milestones: [],
      weakPointRecommendations: [],

      // Deck actions
      addDeck: (name, description, color) => {
        const id = uuidv4();
        set((state) => ({
          decks: [
            ...state.decks,
            {
              id,
              name,
              description,
              color,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      updateDeck: (id, updates) => {
        set((state) => ({
          decks: state.decks.map((deck) =>
            deck.id === id ? { ...deck, ...updates } : deck
          ),
        }));
      },

      deleteDeck: (id) => {
        set((state) => ({
          decks: state.decks.filter((deck) => deck.id !== id),
          cards: state.cards.filter((card) => card.deckId !== id),
          currentDeckId: state.currentDeckId === id ? null : state.currentDeckId,
        }));
        // Supabase からも削除（非同期、エラーはログのみ）
        deleteCardsByDeckRemote(id).catch(() => {});
        deleteDeckRemote(id).catch(() => {});
      },

      // Card actions
      addCard: (deckId, front, back, type = 'flashcard', options) => {
        const id = uuidv4();
        const card = createCard(id, deckId, front, back, type, options);
        set((state) => ({
          cards: [...state.cards, card],
        }));
      },

      updateCard: (id, updates) => {
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id
              ? { ...card, ...updates, updatedAt: new Date().toISOString() }
              : card
          ),
        }));
      },

      deleteCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((card) => card.id !== id),
        }));
      },

      reviewCardAction: (cardId, quality) => {
        // 回答履歴を記録（更新前のカード状態をスナップショット）
        const cardBeforeReview = get().cards.find(c => c.id === cardId);
        if (cardBeforeReview) {
          import('../lib/syncService').then(({ insertCardReview }) => {
            insertCardReview(cardBeforeReview, quality);
          });
        }

        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId ? reviewCard(card, quality) : card
          ),
        }));
      },

      importCards: (deckId, newCards) => {
        const cards = newCards.map(({ front, back, type = 'flashcard', correctAnswer, options, difficulty, correctRate, source, point, subject, subCategory }) =>
          createCard(uuidv4(), deckId, front, back, type, { correctAnswer, options, difficulty, correctRate, source, point, subject, subCategory })
        );
        set((state) => ({
          cards: [...state.cards, ...cards],
        }));
      },

      importCardsToMultipleDecks: (baseName, color, cardsBySubject) => {
        const newDecks: Deck[] = [];
        const newCards: Card[] = [];

        for (const [subject, subjectCards] of Object.entries(cardsBySubject)) {
          const deckId = uuidv4();
          newDecks.push({
            id: deckId,
            name: `${baseName} - ${subject}`,
            description: '',
            color,
            createdAt: new Date().toISOString(),
          });
          for (const card of subjectCards) {
            newCards.push(
              createCard(uuidv4(), deckId, card.front, card.back, card.type || 'flashcard', {
                correctAnswer: card.correctAnswer,
                options: card.options,
                difficulty: card.difficulty,
                correctRate: card.correctRate,
                source: card.source,
                point: card.point,
                subject: card.subject,
                subCategory: card.subCategory,
              })
            );
          }
        }

        set((state) => ({
          decks: [...state.decks, ...newDecks],
          cards: [...state.cards, ...newCards],
        }));
      },

      // Study actions
      getDueCardsForDeck: (deckId, subjectFilter?) => {
        const { cards } = get();
        let deckCards = cards.filter((c) => c.deckId === deckId);
        if (subjectFilter) {
          deckCards = deckCards.filter((c) => c.subject === subjectFilter);
        }
        return getDueCards(deckCards);
      },

      getCardsForDeck: (deckId) => {
        return get().cards.filter((c) => c.deckId === deckId);
      },

      getSubjectsForDeck: (deckId) => {
        const deckCards = get().cards.filter((c) => c.deckId === deckId);
        const subjects = new Set<string>();
        for (const card of deckCards) {
          if (card.subject) {
            subjects.add(card.subject);
          }
        }
        return Array.from(subjects).sort();
      },

      recordSession: (deckId, cardsStudied, correctCount) => {
        const session: StudySession = {
          id: uuidv4(),
          deckId,
          cardsStudied,
          correctCount,
          date: new Date().toISOString(),
        };
        set((state) => ({
          sessions: [...state.sessions, session],
        }));
        get().updateStreak();
      },

      // Navigation
      setCurrentDeck: (deckId) => set({ currentDeckId: deckId }),
      setCurrentView: (view) => set({ currentView: view }),

      // Stats
      updateStreak: () => {
        const today = new Date().toDateString();
        const { lastStudyDate, streak } = get();

        if (lastStudyDate === today) {
          return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastStudyDate === yesterday.toDateString()) {
          set({ streak: streak + 1, lastStudyDate: today });
        } else {
          set({ streak: 1, lastStudyDate: today });
        }
      },

      getTodayStats: () => {
        const today = new Date().toDateString();
        const todaySessions = get().sessions.filter(
          (s) => new Date(s.date).toDateString() === today
        );

        const cardsStudied = todaySessions.reduce((sum, s) => sum + s.cardsStudied, 0);
        const correctCount = todaySessions.reduce((sum, s) => sum + s.correctCount, 0);
        const correctRate = cardsStudied > 0 ? (correctCount / cardsStudied) * 100 : 0;

        return { cardsStudied, correctRate };
      },

      // Multi-exam actions
      addExam: (exam) => {
        set((state) => ({
          exams: [...state.exams, { ...exam, id: uuidv4() }],
        }));
      },

      updateExam: (id, updates) => {
        set((state) => ({
          exams: state.exams.map((e) => e.id === id ? { ...e, ...updates } : e),
        }));
      },

      removeExam: (id) => {
        set((state) => ({
          exams: state.exams.filter((e) => e.id !== id),
        }));
      },

      getDecksForExam: (examId) => {
        const { exams, decks } = get();
        const exam = exams.find((e) => e.id === examId);
        if (!exam || !exam.deckPattern) return [];
        return decks.filter((d) => d.name.includes(exam.deckPattern));
      },

      getExamStats: () => {
        const { exams, decks, cards } = get();
        if (exams.length === 0) return [];

        const now = new Date();

        // First pass: compute raw data per exam
        const rawData = exams.map((exam) => {
          const examDecks = exam.deckPattern
            ? decks.filter((d) => d.name.includes(exam.deckPattern))
            : [];
          const examDeckIds = new Set(examDecks.map((d) => d.id));
          const examCards = cards.filter((c) => examDeckIds.has(c.deckId));
          const daysLeft = Math.max(1, Math.ceil(
            (new Date(exam.examDate).getTime() - now.getTime()) / 86400000
          ));
          const masteredCards = examCards.filter((c) => c.repetition >= 3).length;
          const dueCards = examCards.filter((c) => new Date(c.nextReview) <= now).length;
          const remaining = examCards.length - masteredCards;

          return {
            exam,
            daysLeft,
            totalCards: examCards.length,
            masteredCards,
            dueCards,
            remaining,
            urgency: (1 / daysLeft) * exam.weight,
          };
        });

        // Urgency sum for normalization
        const urgencySum = rawData.reduce((sum, d) => sum + d.urgency, 0) || 1;

        // Second pass: compute weighted quotas
        return rawData.map((d) => {
          const share = d.urgency / urgencySum;
          const rawQuota = d.remaining / d.daysLeft;
          const dailyQuota = Math.max(5, Math.ceil(rawQuota * share * exams.length));

          return {
            examId: d.exam.id,
            daysLeft: d.daysLeft,
            totalCards: d.totalCards,
            masteredCards: d.masteredCards,
            dueCards: d.dueCards,
            dailyQuota,
          };
        });
      },

      getTotalDailyQuota: () => {
        return get().getExamStats().reduce((sum, s) => sum + s.dailyQuota, 0);
      },

      getSmartStudyQueue: () => {
        const { exams, decks, cards, weakPointRecommendations } = get();
        const examStats = get().getExamStats();
        if (examStats.length === 0) {
          return getDueCards(cards);
        }

        const now = new Date();
        const buckets: { cards: Card[]; quota: number }[] = [];

        for (const stat of examStats) {
          const exam = exams.find((e) => e.id === stat.examId)!;
          const examDecks = exam.deckPattern
            ? decks.filter((d) => d.name.includes(exam.deckPattern))
            : [];
          const examDeckIds = new Set(examDecks.map((d) => d.id));
          let dueCards = cards
            .filter((c) => examDeckIds.has(c.deckId) && new Date(c.nextReview) <= now)
            .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());

          // Build weak point lookup for this exam: subject → priorityScore
          const examRecs = weakPointRecommendations.filter(r => r.examName === exam.name);
          const weakSubjectScores = new Map<string, number>();
          for (const rec of examRecs) {
            weakSubjectScores.set(rec.subject, rec.priorityScore);
          }

          // Sort by priority tiers:
          // 1. prioritySubjects && weak point → highest
          // 2. prioritySubjects only
          // 3. weak point only (by priorityScore desc)
          // 4. rest (by nextReview asc, already sorted)
          const isPriority = (c: Card) => exam.prioritySubjects.includes(c.subject || '');
          const weakScore = (c: Card) => weakSubjectScores.get(c.subject || '') ?? 0;

          dueCards.sort((a, b) => {
            const aPri = isPriority(a);
            const bPri = isPriority(b);
            const aWeak = weakScore(a);
            const bWeak = weakScore(b);

            // Tier: priority+weak=3, priority=2, weak=1, other=0
            const aTier = (aPri && aWeak > 0) ? 3 : aPri ? 2 : aWeak > 0 ? 1 : 0;
            const bTier = (bPri && bWeak > 0) ? 3 : bPri ? 2 : bWeak > 0 ? 1 : 0;

            if (aTier !== bTier) return bTier - aTier;
            // Within weak tiers, sort by priorityScore desc
            if (aWeak !== bWeak) return bWeak - aWeak;
            // Finally by nextReview asc
            return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
          });

          buckets.push({
            cards: dueCards.slice(0, stat.dailyQuota),
            quota: stat.dailyQuota,
          });
        }

        // Interleave: round-robin across exams
        const result: Card[] = [];
        const indices = buckets.map(() => 0);
        let anyAdded = true;

        while (anyAdded) {
          anyAdded = false;
          for (let i = 0; i < buckets.length; i++) {
            if (indices[i] < buckets[i].cards.length) {
              result.push(buckets[i].cards[indices[i]]);
              indices[i]++;
              anyAdded = true;
            }
          }
        }

        return result;
      },

      // Milestone actions
      addMilestone: (milestone) => {
        const now = new Date().toISOString();
        set((state) => ({
          milestones: [...state.milestones, {
            ...milestone,
            id: uuidv4(),
            status: 'upcoming',
            createdAt: now,
            updatedAt: now,
          }],
        }));
      },

      updateMilestone: (id, updates) => {
        set((state) => ({
          milestones: state.milestones.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
        }));
      },

      deleteMilestone: (id) => {
        set((state) => ({
          milestones: state.milestones.filter((m) => m.id !== id),
        }));
      },

      recordMockExamResult: (id, actualScore) => {
        set((state) => ({
          milestones: state.milestones.map((m) =>
            m.id === id
              ? { ...m, actualScore, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : m
          ),
        }));
      },

      getUpcomingMilestones: (examName?) => {
        const today = new Date().toISOString().split('T')[0];
        return get().milestones
          .filter((m) => m.status === 'upcoming' && m.targetDate >= today && (!examName || m.examName === examName))
          .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
      },
    }),
    {
      name: 'anki-flashcard-storage',
    }
  )
);
