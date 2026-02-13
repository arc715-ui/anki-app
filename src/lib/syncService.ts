import { supabase } from './supabase';
import type { Card, Deck, StudySession, Exam, Milestone } from '../types';

// Helper to convert snake_case to camelCase
function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

// ============ DECKS ============

export async function fetchDecks(userId: string): Promise<Deck[]> {
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching decks:', error);
    return [];
  }

  return (data || []).map(d => toCamelCase(d) as unknown as Deck);
}

export async function upsertDeck(userId: string, deck: Deck): Promise<void> {
  const { error } = await supabase
    .from('decks')
    .upsert({
      id: deck.id,
      user_id: userId,
      name: deck.name,
      description: deck.description,
      color: deck.color,
      created_at: deck.createdAt,
    });

  if (error) {
    console.error('Error upserting deck:', error);
  }
}

export async function deleteDeckRemote(deckId: string): Promise<void> {
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId);

  if (error) {
    console.error('Error deleting deck:', error);
  }
}

// ============ CARDS ============

export async function fetchCards(userId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching cards:', error);
    return [];
  }

  return (data || []).map(c => ({
    id: c.id,
    deckId: c.deck_id,
    type: c.type,
    front: c.front,
    back: c.back,
    correctAnswer: c.correct_answer,
    options: c.options,
    interval: c.interval,
    repetition: c.repetition,
    easeFactor: c.ease_factor,
    nextReview: c.next_review,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    difficulty: c.difficulty,
    correctRate: c.correct_rate,
    source: c.source,
    point: c.point,
    subject: c.subject,
    subCategory: c.sub_category,
  })) as Card[];
}

export async function upsertCard(userId: string, card: Card): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .upsert({
      id: card.id,
      user_id: userId,
      deck_id: card.deckId,
      type: card.type,
      front: card.front,
      back: card.back,
      correct_answer: card.correctAnswer,
      options: card.options,
      interval: card.interval,
      repetition: card.repetition,
      ease_factor: card.easeFactor,
      next_review: card.nextReview,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      difficulty: card.difficulty,
      correct_rate: card.correctRate,
      source: card.source,
      point: card.point,
      subject: card.subject,
      sub_category: card.subCategory,
    });

  if (error) {
    console.error('Error upserting card:', error);
  }
}

export async function upsertCards(userId: string, cards: Card[]): Promise<void> {
  if (cards.length === 0) return;

  const { error } = await supabase
    .from('cards')
    .upsert(cards.map(card => ({
      id: card.id,
      user_id: userId,
      deck_id: card.deckId,
      type: card.type,
      front: card.front,
      back: card.back,
      correct_answer: card.correctAnswer,
      options: card.options,
      interval: card.interval,
      repetition: card.repetition,
      ease_factor: card.easeFactor,
      next_review: card.nextReview,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      difficulty: card.difficulty,
      correct_rate: card.correctRate,
      source: card.source,
      point: card.point,
      subject: card.subject,
      sub_category: card.subCategory,
    })));

  if (error) {
    console.error('Error upserting cards:', error);
  }
}

export async function deleteCardRemote(cardId: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId);

  if (error) {
    console.error('Error deleting card:', error);
  }
}

// ============ CARD REVIEWS (個別回答履歴) ============

export async function insertCardReview(
  card: Card,
  quality: number
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from('card_reviews')
    .insert({
      user_id: session.user.id,
      card_id: card.id,
      deck_id: card.deckId,
      quality,
      ease_factor_before: card.easeFactor,
      interval_before: card.interval,
      repetition_before: card.repetition,
      subject: card.subject || null,
      sub_category: card.subCategory || null,
    });

  if (error) {
    console.error('Error inserting card review:', error);
  }
}

// ============ STUDY SESSIONS ============

export async function fetchStudySessions(userId: string): Promise<StudySession[]> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching study sessions:', error);
    return [];
  }

  return (data || []).map(s => ({
    id: s.id,
    deckId: s.deck_id,
    cardsStudied: s.cards_studied,
    correctCount: s.correct_count,
    date: s.date,
  })) as StudySession[];
}

export async function upsertStudySession(userId: string, session: StudySession): Promise<void> {
  const { error } = await supabase
    .from('study_sessions')
    .upsert({
      id: session.id,
      user_id: userId,
      deck_id: session.deckId,
      cards_studied: session.cardsStudied,
      correct_count: session.correctCount,
      date: session.date,
    });

  if (error) {
    console.error('Error upserting study session:', error);
  }
}

// ============ MILESTONES ============

export async function fetchMilestones(userId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true });

  if (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }

  return (data || []).map(m => ({
    id: m.id,
    examName: m.exam_name,
    title: m.title,
    targetDate: m.target_date,
    targetScore: m.target_score,
    actualScore: m.actual_score,
    targetSubjects: m.target_subjects,
    status: m.status,
    notes: m.notes,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  })) as Milestone[];
}

export async function upsertMilestones(userId: string, milestones: Milestone[]): Promise<void> {
  if (milestones.length === 0) return;

  const { error } = await supabase
    .from('milestones')
    .upsert(milestones.map(m => ({
      id: m.id,
      user_id: userId,
      exam_name: m.examName,
      title: m.title,
      target_date: m.targetDate,
      target_score: m.targetScore,
      actual_score: m.actualScore,
      target_subjects: m.targetSubjects,
      status: m.status,
      notes: m.notes,
      created_at: m.createdAt,
      updated_at: m.updatedAt,
    })));

  if (error) {
    console.error('Error upserting milestones:', error);
  }
}

// ============ USER SETTINGS ============

export async function fetchUserSettings(userId: string): Promise<{
  streak: number;
  lastStudyDate: string | null;
  exams: Exam[];
} | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching user settings:', error);
    return null;
  }

  return {
    streak: data.streak,
    lastStudyDate: data.last_study_date,
    exams: data.exams ?? [],
  };
}

export async function upsertUserSettings(
  userId: string,
  streak: number,
  lastStudyDate: string | null,
  exams: Exam[] = []
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      streak,
      last_study_date: lastStudyDate,
      exams,
    });

  if (error) {
    console.error('Error upserting user settings:', error);
  }
}

// ============ FULL SYNC ============

export async function syncToRemote(
  userId: string,
  decks: Deck[],
  cards: Card[],
  sessions: StudySession[],
  streak: number,
  lastStudyDate: string | null,
  exams: Exam[] = [],
  milestones: Milestone[] = []
): Promise<void> {
  await Promise.all([
    ...decks.map(deck => upsertDeck(userId, deck)),
    upsertCards(userId, cards),
    ...sessions.map(session => upsertStudySession(userId, session)),
    upsertUserSettings(userId, streak, lastStudyDate, exams),
    upsertMilestones(userId, milestones),
  ]);
}

export async function fetchAllFromRemote(userId: string): Promise<{
  decks: Deck[];
  cards: Card[];
  sessions: StudySession[];
  streak: number;
  lastStudyDate: string | null;
  exams: Exam[];
  milestones: Milestone[];
}> {
  const [decks, cards, sessions, settings, milestones] = await Promise.all([
    fetchDecks(userId),
    fetchCards(userId),
    fetchStudySessions(userId),
    fetchUserSettings(userId),
    fetchMilestones(userId),
  ]);

  return {
    decks,
    cards,
    sessions,
    streak: settings?.streak ?? 0,
    lastStudyDate: settings?.lastStudyDate ?? null,
    exams: settings?.exams ?? [],
    milestones,
  };
}
