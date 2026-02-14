-- ============================================================
-- Phase D: Telegram Bot用 Supabaseスキーマ
--
-- 実行場所: Supabase Dashboard > SQL Editor
-- 前提: 01_supabase_setup.sql が実行済みであること
-- ============================================================

-- ============================================================
-- ① telegram_study_logs: Telegram経由の学習記録
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exam_name TEXT NOT NULL,
  short_name TEXT,
  subject TEXT,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL,
  source TEXT DEFAULT 'telegram',
  raw_message TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_tg_logs_user_date
  ON telegram_study_logs (user_id, date DESC);

-- ============================================================
-- ② telegram_bot_state: ポーリングoffset管理（シングルトン）
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_bot_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_update_id BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO telegram_bot_state (id, last_update_id)
VALUES (1, 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ③ telegram_daily_summary: Telegram記録の日次集計ビュー
-- ============================================================

CREATE OR REPLACE VIEW telegram_daily_summary AS
SELECT
  user_id,
  exam_name,
  short_name,
  date,
  SUM(total_questions) AS total_studied,
  SUM(correct_count) AS total_correct,
  COUNT(*) AS session_count
FROM telegram_study_logs
GROUP BY user_id, exam_name, short_name, date;

-- ============================================================
-- ④ 確認クエリ
-- ============================================================

-- SELECT * FROM telegram_bot_state;
-- SELECT * FROM telegram_study_logs LIMIT 10;
-- SELECT * FROM telegram_daily_summary;
