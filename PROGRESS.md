# 暗記カードアプリ 開発進捗まとめ

## プロジェクト概要

React 19 PWA + Supabase + n8n + Telegram + Notion による多資格同時学習システム。
2026年の国家試験4つ（社労士・行政書士・中小企業診断士・労働衛生コンサルタント）を同時対策する。

---

## 完了フェーズ

### Phase A: n8n → Telegram 通知（完了）

- 朝の学習リマインダー（02: morning workflow）
- 夕方の進捗レポート（03: evening workflow）
- 週次の弱点分析（04: weekly analysis workflow）

### Phase B: Supabase → Notion 日次同期（完了）

- `n8n/06_notion_setup.json` — Notion DB 一括作成ワークフロー（1回実行済み）
- `n8n/07_workflow_daily_notion_sync.json` — 毎日21:30 JST に4試験の学習ログを Notion へ同期

**技術メモ:**
- n8n.cloud v2.6.3 の Code ノードでは `fetch()` / `$http.request()` は使用不可 → HTTP Request ノードで API 呼び出し
- Code ノードはデータ変換専用。複数アイテム処理は `$input.all()` + for ループ必須
- n8n.cloud の Variables 機能は利用不可 → 認証情報はノードに直接ハードコード

**認証情報（n8n ワークフロー内に埋め込み済み）:**
- SUPABASE_URL: `https://cgnrttgyjtjjzwkygvas.supabase.co`
- SUPABASE_SERVICE_ROLE_KEY: `eyJhbGci...oMn06ImLIKK9FU8edF59OFelkrLoNphrKX_bbzXSoC4`
- USER_ID: `98ba6492-ede4-4b57-a00d-e8b30fac78c4`
- NOTION_API_KEY: `ntn_b90150843475R4eCp4BtqcFuo9GYylIYCW7t0iZoNVC8Jc`
- NOTION_DAILY_LOG_DB_ID: `30621957-453b-8158-9455-c55501185c6f`
- NOTION_DASHBOARD_PAGE_ID: `29521957-453b-8049-9634-cc7440f09634`

### カード回答履歴の記録（完了）

- `n8n/08_card_reviews_table.sql` — Supabase に `card_reviews` テーブル作成済み
- `src/lib/syncService.ts` — `insertCardReview()` 関数追加
- `src/stores/useStore.ts` — `reviewCardAction` で回答ごとに履歴を Supabase に記録
- `recent_mistakes_summary` ビュー — 科目別の正答率・直近7日の間違い数を集計

### 一問一答パーサー改修（作業中 → 要確認）

**目的:** 多肢択一形式だとスクロールが多くて演習しにくいため、各選択肢を独立した正誤問題（true_false）に分割する。

**変更ファイル:** `src/components/ImportExam.tsx`

**追加したヘルパー関数:**

| 関数 | 用途 |
|------|------|
| `splitByKanaMarkers()` | 行政書士の組合せ問題: ア．～イ．～ で解説を分割 |
| `extractKanaStatements()` | 問題文中のア～オの記述を抽出 |
| `isComboQuestion()` | 選択肢が「ア・イ」形式かどうかで組合せ問題を判定 |
| `splitByJapaneseNumbered()` | `1．妥当でない。… 2．正しい。…` パターンで分割 |
| `splitConsultantExplanation()` | `選択肢別: 1:誤り。…` パターンで分割 |
| `detectCorrectness()` / `detectChoiceCorrectness()` | 正誤キーワードから自動判定 |

**各パーサーの状態:**

| 試験 | 分割 | 解説分割 | 除外 | 備考 |
|------|------|----------|------|------|
| 社労士 | ✅ 元から一問一答形式 | ✅ 元から選択肢別解説あり | — | 変更なし |
| 行政書士 | ✅ 選択肢ごとに分割 | ⚠️ 要確認 | `subject` が「記述式」「多肢選択式」はスキップ | 解説パターン: `1．妥当でない。…` |
| 労衛コン | ✅ 選択肢ごとに分割 | ⚠️ 要確認 | `question_type` が「記述式」「穴埋め」はスキップ | 解説パターン: `選択肢別: 1:誤り。… / 2:…` |
| 中小企業診断士 | ✅ 選択肢ごとに分割 | ⚠️ 要確認 | — | 労衛コンと同じ分割ロジックを適用 |

**行政書士JSONデータの構造:**
- `subject` フィールド: 「民法」「行政法」「憲法」「商法」「基礎法学」「基礎知識」「記述式」「多肢選択式」
- `sub_category` フィールド: 「債権」「物権」「総則」「行政総論」など
- 記述式・多肢選択式は `subject` フィールドに格納されている（`sub_category` ではない）
- 解説の番号区切りは全角ピリオド: `1．含まれる。…` `2．明文で規定されていない。…`

**⚠️ 現在の課題（Claude Code で要確認）:**

1. **解説分割が実際に機能しているか未確認** — `splitByJapaneseNumbered` の正規表現を `数字＋全角ピリオド(．)` に対応させたが、デプロイ後の動作確認がまだ
2. **PWA キャッシュ問題** — `vite.config.ts` に `skipWaiting: true` + `clientsClaim: true` を追加済み。初回はブラウザの DevTools → Application → Service Workers → Unregister + Clear site data が必要

---

### Phase C: Claude Haiku 週次弱点分析（完了）

- n8n ワークフロー `rMDjNM5FWc80S297`（毎週月曜7時）で自動実行
- Supabase `weak_cards_summary` + `recent_mistakes_summary` → Claude Haiku が弱点分析
- 分析結果を `weak_point_recommendations` テーブルに保存 + Telegram に送信
- アプリ側: `fetchWeakPointRecommendations()` で直近週の推奨を取得
- スマートキューで弱点科目を4段階優先ソート（prioritySubjects + weak point → 最優先）

### Phase D: Telegram Bot（完了）

- n8n ワークフロー `03GsYcR7SuhcMesw`（30秒ポーリング）で稼働中
- `/start` `/menu` で InlineKeyboard メニュー表示
- 学習記録: 自然言語メッセージ → Claude Haiku 解析 → `telegram_study_logs` に保存
- 進捗確認・マイルストーン表示
- Supabase テーブル: `telegram_study_logs`, `telegram_bot_state`, `telegram_daily_summary` ビュー

### Phase E: アプリ内ダッシュボード（完了）

- `src/lib/analyticsService.ts` — ダッシュボード用データ取得（`card_reviews` + `recent_mistakes_summary` ビュー）
- `src/components/Dashboard.tsx` — Recharts + カスタム SVG で4セクション構成:
  - 試験別マスタリー進捗バー（`getExamStats()` 再利用）
  - 12週学習カレンダーヒートマップ（GitHub風、カスタム SVG グリッド）
  - 日別学習量 + 正答率チャート（ComposedChart: Bar + Line）
  - 科目別正答率 横棒グラフ（弱点科目を赤色ハイライト）
- `src/App.tsx` — ナビバーに「📊 分析」ボタン追加
- `src/index.css` — ダッシュボード CSS（`.dashboard`, `.mastery-bar`, `.heatmap` 等）
- 依存追加: `recharts`

## 全フェーズ完了 🎉

---

## ファイル構成

```
anki-app/
├── src/
│   ├── components/
│   │   ├── ImportExam.tsx        ← パーサー改修（一問一答化 + 解説分割）
│   │   ├── StudySession.tsx
│   │   ├── DeckList.tsx
│   │   ├── CardEditor.tsx
│   │   ├── MilestoneManager.tsx
│   │   ├── Dashboard.tsx          ← Phase E ダッシュボード（Recharts）
│   │   └── AuthButton.tsx
│   ├── stores/
│   │   ├── useStore.ts           ← reviewCardAction に回答履歴記録を追加
│   │   └── useAuth.ts
│   ├── lib/
│   │   ├── syncService.ts        ← insertCardReview() + fetchWeakPointRecommendations()
│   │   ├── analyticsService.ts   ← Phase E ダッシュボード用データ取得
│   │   ├── supabase.ts
│   │   └── sm2.ts
│   ├── App.tsx                   ← Supabase 双方向同期 + 弱点推奨取得
│   └── types.ts                  ← WeakPointRecommendation 型追加
├── n8n/
│   ├── 01_supabase_setup.sql
│   ├── 02_workflow_morning.json
│   ├── 03_workflow_evening.json
│   ├── 04_workflow_weekly_analysis.json  ← Phase C (active)
│   ├── 05_exam_config_and_milestones.sql
│   ├── 06_notion_setup.json
│   ├── 07_workflow_daily_notion_sync.json
│   ├── 08_card_reviews_table.sql
│   ├── 09_telegram_schema.sql       ← Phase D テーブル定義
│   └── 10_workflow_telegram_bot.json ← Phase D (active)
├── vite.config.ts                ← VitePWA + skipWaiting 設定
└── .github/workflows/deploy.yml  ← GitHub Pages 自動デプロイ
```

---

## デプロイ

- **ホスティング:** GitHub Pages (`https://arc715-ui.github.io/anki-app/`)
- **CI/CD:** GitHub Actions（main push で自動ビルド・デプロイ）
- **確認方法:** `gh run list --limit 1` で ✓ を確認 → ブラウザリロード

---

## 既知の注意点

1. **Supabase 同期の mergeById 問題**: ローカルでデッキを削除しても、Supabase にデータが残っていればログイン時に復活する。削除を反映するには Supabase 側でも DELETE が必要
2. **n8n Code ノード制限**: HTTP リクエストは一切不可（fetch / $http 両方使えない）。必ず HTTP Request ノードを使うこと
3. **PWA キャッシュ**: コード更新後、古い Service Worker が残る場合あり。`skipWaiting + clientsClaim` を設定済みだが、初回は手動で Unregister が必要な場合がある
