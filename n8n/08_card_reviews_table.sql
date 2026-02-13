-- ============================================================
-- card_reviews テーブル: 個別の回答履歴を記録
-- 用途: Phase C 弱点分析の精度向上
--       「いつ、どのカードを、どう間違えたか」を追跡
--
-- 実行場所: Supabase Dashboard > SQL Editor
-- ============================================================

-- ① card_reviews テーブル作成
CREATE TABLE IF NOT EXISTS card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  quality SMALLINT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  -- SM-2 の quality: 0-2 = 不正解（0:全く覚えていない, 1:間違えた, 2:辛うじて思い出した）
  --                  3-5 = 正解  （3:難しかった, 4:普通, 5:簡単）
  is_correct BOOLEAN GENERATED ALWAYS AS (quality >= 3) STORED,
  -- レビュー時点のカード状態スナップショット
  ease_factor_before FLOAT,
  interval_before INT,
  repetition_before INT,
  -- メタデータ
  subject TEXT,
  sub_category TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ② インデックス（弱点分析クエリの高速化）
CREATE INDEX IF NOT EXISTS idx_card_reviews_user_date
  ON card_reviews (user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_reviews_card
  ON card_reviews (card_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_reviews_subject
  ON card_reviews (user_id, subject, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_reviews_incorrect
  ON card_reviews (user_id, reviewed_at DESC)
  WHERE quality < 3;

-- ③ RLS（Row Level Security）
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own reviews'
  ) THEN
    CREATE POLICY "Users can view own reviews"
      ON card_reviews FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own reviews'
  ) THEN
    CREATE POLICY "Users can insert own reviews"
      ON card_reviews FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage reviews'
  ) THEN
    CREATE POLICY "Service role can manage reviews"
      ON card_reviews FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================================
-- ④ 弱点分析用ビュー: 直近の間違いパターンを科目別に集計
-- Phase C の Claude 分析で使用
-- ============================================================

DROP VIEW IF EXISTS recent_mistakes_summary CASCADE;

CREATE OR REPLACE VIEW recent_mistakes_summary AS
SELECT
  cr.user_id,
  cr.subject,
  cr.sub_category,
  d.name AS deck_name,
  COUNT(*) AS total_reviews,
  COUNT(*) FILTER (WHERE cr.quality < 3) AS mistake_count,
  COUNT(*) FILTER (WHERE cr.quality >= 3) AS correct_count,
  ROUND(
    (COUNT(*) FILTER (WHERE cr.quality >= 3))::numeric / GREATEST(COUNT(*), 1) * 100, 1
  ) AS correct_rate,
  -- 直近7日の間違い数
  COUNT(*) FILTER (
    WHERE cr.quality < 3 AND cr.reviewed_at >= NOW() - INTERVAL '7 days'
  ) AS mistakes_last_7d,
  -- 直近7日の総レビュー数
  COUNT(*) FILTER (
    WHERE cr.reviewed_at >= NOW() - INTERVAL '7 days'
  ) AS reviews_last_7d,
  -- 最後に間違えた日時
  MAX(cr.reviewed_at) FILTER (WHERE cr.quality < 3) AS last_mistake_at
FROM card_reviews cr
JOIN decks d ON cr.deck_id = d.id
WHERE cr.subject IS NOT NULL AND cr.subject != ''
GROUP BY cr.user_id, cr.subject, cr.sub_category, d.name
ORDER BY mistake_count DESC;


-- ============================================================
-- ⑤ 確認クエリ（テスト用）
-- ============================================================

-- テーブル確認
-- SELECT * FROM card_reviews LIMIT 10;

-- 直近の間違いサマリー
-- SELECT * FROM recent_mistakes_summary WHERE user_id = 'YOUR_USER_ID';

-- 特定カードの回答履歴
-- SELECT cr.*, c.front, c.subject
-- FROM card_reviews cr
-- JOIN cards c ON cr.card_id = c.id
-- WHERE cr.user_id = 'YOUR_USER_ID'
-- ORDER BY cr.reviewed_at DESC
-- LIMIT 20;
