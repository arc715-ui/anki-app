import { supabase } from './supabase';

// ============ Types ============

export interface DailyStudyStat {
  date: string; // YYYY-MM-DD
  total: number;
  correct: number;
}

export interface SubjectAccuracy {
  subject: string;
  total: number;
  correct: number;
  rate: number;
  examName: string;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
}

// ============ Data Fetching ============

export async function fetchDailyStudyStats(
  userId: string,
  days = 30
): Promise<DailyStudyStat[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('card_reviews')
    .select('reviewed_at, quality')
    .eq('user_id', userId)
    .gte('reviewed_at', since.toISOString())
    .order('reviewed_at', { ascending: true });

  if (error) {
    console.error('Error fetching daily study stats:', error);
    return [];
  }

  // Aggregate by date in JS
  const byDate = new Map<string, { total: number; correct: number }>();
  for (const row of data || []) {
    const date = row.reviewed_at.slice(0, 10); // YYYY-MM-DD
    const entry = byDate.get(date) || { total: 0, correct: 0 };
    entry.total++;
    if (row.quality >= 3) entry.correct++;
    byDate.set(date, entry);
  }

  // Fill missing dates
  const result: DailyStudyStat[] = [];
  const cursor = new Date(since);
  const today = new Date();
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const entry = byDate.get(dateStr) || { total: 0, correct: 0 };
    result.push({ date: dateStr, ...entry });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export async function fetchSubjectAccuracy(
  userId: string
): Promise<SubjectAccuracy[]> {
  const { data, error } = await supabase
    .from('recent_mistakes_summary')
    .select('subject, total_reviews, correct_count, correct_rate, deck_name')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching subject accuracy:', error);
    return [];
  }

  return (data || []).map((row) => ({
    subject: row.subject,
    total: row.total_reviews,
    correct: row.correct_count,
    rate: Number(row.correct_rate),
    examName: row.deck_name,
  }));
}

export async function fetchHeatmapData(
  userId: string,
  days = 84
): Promise<HeatmapDay[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('card_reviews')
    .select('reviewed_at')
    .eq('user_id', userId)
    .gte('reviewed_at', since.toISOString());

  if (error) {
    console.error('Error fetching heatmap data:', error);
    return [];
  }

  const byDate = new Map<string, number>();
  for (const row of data || []) {
    const date = row.reviewed_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }

  const result: HeatmapDay[] = [];
  const cursor = new Date(since);
  const today = new Date();
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: byDate.get(dateStr) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
