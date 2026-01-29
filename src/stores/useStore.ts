import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Card, Deck, StudySession, CardType, CardOption, Quality } from '../types';
import { createCard, reviewCard, getDueCards } from '../lib/sm2';

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

  // Actions - Decks
  addDeck: (name: string, description: string, color: string) => string;
  updateDeck: (id: string, updates: Partial<Omit<Deck, 'id' | 'createdAt'>>) => void;
  deleteDeck: (id: string) => void;

  // Actions - Cards
  addCard: (deckId: string, front: string, back: string, type?: CardType, options?: { correctAnswer?: boolean; options?: CardOption[] }) => void;
  updateCard: (id: string, updates: Partial<Pick<Card, 'front' | 'back' | 'correctAnswer' | 'options'>>) => void;
  deleteCard: (id: string) => void;
  reviewCardAction: (cardId: string, quality: Quality) => void;
  importCards: (deckId: string, cards: Array<{ front: string; back: string; type?: CardType; correctAnswer?: boolean; options?: CardOption[] }>) => void;

  // Actions - Study
  getDueCardsForDeck: (deckId: string) => Card[];
  getCardsForDeck: (deckId: string) => Card[];
  recordSession: (deckId: string, cardsStudied: number, correctCount: number) => void;

  // Actions - Navigation
  setCurrentDeck: (deckId: string | null) => void;
  setCurrentView: (view: AppState['currentView']) => void;

  // Actions - Stats
  updateStreak: () => void;
  getTodayStats: () => { cardsStudied: number; correctRate: number };
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
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId ? reviewCard(card, quality) : card
          ),
        }));
      },

      importCards: (deckId, newCards) => {
        const cards = newCards.map(({ front, back, type = 'flashcard', correctAnswer, options }) =>
          createCard(uuidv4(), deckId, front, back, type, { correctAnswer, options })
        );
        set((state) => ({
          cards: [...state.cards, ...cards],
        }));
      },

      // Study actions
      getDueCardsForDeck: (deckId) => {
        const { cards } = get();
        return getDueCards(cards.filter((c) => c.deckId === deckId));
      },

      getCardsForDeck: (deckId) => {
        return get().cards.filter((c) => c.deckId === deckId);
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
          return; // Already studied today
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastStudyDate === yesterday.toDateString()) {
          // Continuing streak
          set({ streak: streak + 1, lastStudyDate: today });
        } else {
          // Streak broken or first time
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
    }),
    {
      name: 'anki-flashcard-storage',
    }
  )
);
