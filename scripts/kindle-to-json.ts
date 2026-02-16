/**
 * kindle-to-json.ts — Extract structured exam questions from Kindle screenshots
 *
 * Uses Claude Vision API to process screenshot batches and output
 * ShindanshiQuestion[] JSON compatible with ImportExam.tsx parseShindanshiData().
 *
 * Usage:
 *   npx tsx scripts/kindle-to-json.ts \
 *     --input screenshots/zaimu \
 *     --output data/shindan_zaimu.json \
 *     --subject "財務・会計"
 *
 * Environment:
 *   ANTHROPIC_API_KEY — Claude API key (required)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShindanshiQuestion {
  year: string;
  subject: string;
  question_number: number;
  question_text: string;
  choices: Record<string, string>;
  correct_answer: string;
  explanation: string;
  sub_category?: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { input: string; output: string; subject: string; batchSize: number; model: string } {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let subject = "";
  let batchSize = 10;
  let model = "claude-haiku-4-5-20251001";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        input = args[++i];
        break;
      case "--output":
        output = args[++i];
        break;
      case "--subject":
        subject = args[++i];
        break;
      case "--batch-size":
        batchSize = parseInt(args[++i], 10);
        break;
      case "--model":
        model = args[++i];
        break;
      case "--sonnet":
        model = "claude-sonnet-4-5-20250929";
        break;
      case "-h":
      case "--help":
        console.log(`Usage: npx tsx scripts/kindle-to-json.ts [options]

Options:
  --input DIR       Directory containing screenshot PNGs (required)
  --output FILE     Output JSON file path (required)
  --subject TEXT    Subject name, e.g. "財務・会計" (required)
  --batch-size N   Screenshots per API call (default: 10)
  --model MODEL    Claude model ID (default: claude-haiku-4-5-20251001)
  --sonnet         Use Sonnet 4.5 instead of Haiku (higher quality, ~4x cost)
  -h, --help       Show this help`);
        process.exit(0);
    }
  }

  if (!input || !output || !subject) {
    console.error("Error: --input, --output, and --subject are all required.");
    console.error("Run with --help for usage info.");
    process.exit(1);
  }

  return { input, output, subject, batchSize, model };
}

// ---------------------------------------------------------------------------
// Screenshot loading
// ---------------------------------------------------------------------------

function loadScreenshots(dir: string): string[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`Error: No image files found in ${dir}`);
    process.exit(1);
  }

  return files.map((f) => path.join(dir, f));
}

function imageToBase64(filePath: string): { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";
  const data = fs.readFileSync(filePath).toString("base64");
  return { data, mediaType };
}

// ---------------------------------------------------------------------------
// Claude Vision API
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `あなたはKindle過去問書籍のスクリーンショットからデータを抽出するエキスパートです。

これらの画像は中小企業診断士1次試験の過去問題集（TBC速修1次過去問題集）のスクリーンショットです。
問題ページと解答・解説ページが含まれています。

以下のルールに従って、各問題を構造化JSONで抽出してください:

## 抽出ルール

1. **問題ページ**:
   - 「平成○○年度 第N問」「令和○○年度 第N問」のヘッダーから year と question_number を抽出
   - 問題文全体を question_text に（表や条件文も含める）
   - 選択肢 ア〜エ（またはオ）を choices オブジェクトに
   - 組合わせ問題（〔解答群〕で ア:①X ②Y ③Z ④W のような形式）も choices にそのまま記載
     例: "ア": "①:BIOS ②:パッチ ③:フリーウェア ④:プラグインソフト"

2. **解答・解説ページ**:
   - 「テーマ」行があれば sub_category に
   - 「解答 X」（Xはア〜エ）から correct_answer を抽出
   - 赤い波線部分や赤字テキストは通常の黒字と同様に抽出（色情報は不要）

   **解説のフォーマット（explanation）— 2パターン**:

   **パターンA: 選択肢別の解説がある場合**
   解答ページで ア, イ, ウ, エ ごとに「適切である」「不適切である」等の解説がある場合:
   → 「選択肢別: ア:解説文 / イ:解説文 / ウ:解説文 / エ:解説文」の形式にする
   → 共通の総論があれば「選択肢別:」の前に配置
   例: "株式会社と合同会社の比較に関する出題である。\\n\\n選択肢別: ア:不適切である。株式会社の株主も... / イ:適切である。株式会社は... / ウ:不適切である。... / エ:不適切である。..."

   **パターンB: 選択肢別でない解説の場合**
   空欄A〜D別、①〜④別、または一括で解説がある場合:
   → 「選択肢別:」マーカーを使わず、そのまま全文を記載
   例: "空欄A: 吸収合併における簡易手続\\n吸収合併において...\\n\\n空欄B: ...\\n\\nよって、エが適切である。"

3. **表・仕訳表・図**:
   - テキストで記述（プレーンテキストまたはmarkdown table）
   - 問題文中の表は question_text に含める
   - 解答ページの表は explanation に含める
   - 空欄問題の表は正確に再現（○/×/A〜D等の記号を含む）

4. **問題と解答のマッチング**:
   - 問題番号でマッチ
   - 画像に含まれる全ての完全な問題を抽出（不完全な問題は前後のバッチで処理されるので省略可）

## 出力形式

JSON配列のみを出力してください（他のテキストは不要）:

\`\`\`json
[
  {
    "year": "平成30年度",
    "question_number": 1,
    "question_text": "問題文（表がある場合はmarkdown tableで含む）",
    "choices": {
      "ア": "選択肢テキスト",
      "イ": "選択肢テキスト",
      "ウ": "選択肢テキスト",
      "エ": "選択肢テキスト"
    },
    "correct_answer": "イ",
    "explanation": "選択肢別: ア:不適切である。理由... / イ:適切である。理由... / ウ:不適切である。理由... / エ:不適切である。理由...",
    "sub_category": "テーマ名"
  },
  {
    "year": "平成30年度",
    "question_number": 2,
    "question_text": "空欄問題の例（表を含む）...",
    "choices": {
      "ア": "A:○ B:× C:× D:○",
      "イ": "A:○ B:× C:× D:×",
      "ウ": "A:× B:○ C:○ D:○",
      "エ": "A:× B:○ C:○ D:×"
    },
    "correct_answer": "エ",
    "explanation": "空欄A: 吸収合併における簡易手続\\n解説文...\\n\\n空欄B: 吸収合併における略式手続\\n解説文...\\n\\n以上より、エが適切である。",
    "sub_category": "組織の基礎的変更"
  }
]
\`\`\`

重要:
- JSON配列のみ出力。\`\`\`json タグや説明文は不要
- 画像に問題が含まれない場合は空配列 [] を返す
- 問題文中の改行は \\n で表現
- 選択肢のキーは必ずカタカナ（ア、イ、ウ、エ、オ）
- correct_answer もカタカナ
- 解説が選択肢別(ア〜エ)の構造なら「選択肢別:」を使う。それ以外は使わない`;

async function extractBatch(
  client: Anthropic,
  imagePaths: string[],
  subject: string,
  batchIndex: number,
  model: string,
  retries = 2
): Promise<ShindanshiQuestion[]> {
  const content: Anthropic.Messages.ContentBlockParam[] = [];

  // Add images
  for (const imgPath of imagePaths) {
    const { data, mediaType } = imageToBase64(imgPath);
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }

  // Add text prompt
  content.push({
    type: "text",
    text: `科目: ${subject}\n\n${EXTRACTION_PROMPT}`,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        messages: [{ role: "user", content }],
      });

      // Extract text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
      }

      let jsonText = textBlock.text.trim();

      // Strip markdown code fences if present
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const questions: ShindanshiQuestion[] = JSON.parse(jsonText);

      // Inject subject into each question
      for (const q of questions) {
        q.subject = subject;
      }

      return questions;
    } catch (err) {
      const isLast = attempt === retries;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (isLast) {
        console.error(`  [Batch ${batchIndex + 1}] FAILED after ${retries + 1} attempts: ${errMsg}`);
        return [];
      }

      console.warn(`  [Batch ${batchIndex + 1}] Attempt ${attempt + 1} failed: ${errMsg}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateQuestions(questions: ShindanshiQuestion[]): ShindanshiQuestion[] {
  const seen = new Map<string, ShindanshiQuestion>();

  for (const q of questions) {
    const key = `${q.year}__${q.question_number}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, q);
    } else {
      // Keep the one with more complete data
      const existingScore =
        (existing.explanation?.length ?? 0) +
        (existing.sub_category ? 10 : 0) +
        Object.keys(existing.choices).length;
      const newScore =
        (q.explanation?.length ?? 0) +
        (q.sub_category ? 10 : 0) +
        Object.keys(q.choices).length;

      if (newScore > existingScore) {
        seen.set(key, q);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year.localeCompare(b.year);
    return a.question_number - b.question_number;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { input, output, subject, batchSize, model } = parseArgs();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    process.exit(1);
  }

  const client = new Anthropic();
  const images = loadScreenshots(input);
  const isHaiku = model.includes("haiku");
  console.log(`Found ${images.length} screenshots in ${input}`);
  console.log(`Subject: ${subject}`);
  console.log(`Model: ${model}${isHaiku ? " (low cost)" : ""}`);
  console.log(`Batch size: ${batchSize}`);

  // Create batches with overlap: each batch shares 2 images with the next
  // This handles questions that span batch boundaries
  const overlap = 2;
  const batches: string[][] = [];
  const step = batchSize - overlap;
  for (let i = 0; i < images.length; i += step) {
    const batch = images.slice(i, i + batchSize);
    if (batch.length > 0) batches.push(batch);
  }

  // Cost estimate
  const tokensPerImage = 1600; // approximate for a Kindle screenshot
  const totalImageTokens = images.length * tokensPerImage;
  const overheadPerBatch = 2000; // system prompt + output
  const totalTokens = totalImageTokens + batches.length * overheadPerBatch;
  const costPer1M = isHaiku ? 0.80 : 3.00;
  const estimatedCost = (totalTokens / 1_000_000) * costPer1M;
  console.log(`Estimated cost: ~$${estimatedCost.toFixed(2)} (${batches.length} batches)`);
  console.log("");

  const allQuestions: ShindanshiQuestion[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const fileNames = batch.map((p) => path.basename(p)).join(", ");
    console.log(`[Batch ${i + 1}/${batches.length}] ${fileNames}`);

    const questions = await extractBatch(client, batch, subject, i, model);
    console.log(`  → Extracted ${questions.length} question(s)`);

    allQuestions.push(...questions);

    // Rate limiting: small delay between batches
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("");

  // Deduplicate (overlap may produce dupes)
  const deduped = deduplicateQuestions(allQuestions);
  console.log(`Total: ${allQuestions.length} extracted → ${deduped.length} unique questions`);

  // Validate
  let warnings = 0;
  for (const q of deduped) {
    if (!q.correct_answer) {
      console.warn(`  WARNING: ${q.year} 第${q.question_number}問 — missing correct_answer`);
      warnings++;
    }
    if (Object.keys(q.choices).length < 2) {
      console.warn(`  WARNING: ${q.year} 第${q.question_number}問 — fewer than 2 choices`);
      warnings++;
    }
    if (!q.explanation) {
      console.warn(`  WARNING: ${q.year} 第${q.question_number}問 — missing explanation`);
      warnings++;
    }
  }

  // Write output
  const outputDir = path.dirname(output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(output, JSON.stringify(deduped, null, 2), "utf-8");
  console.log("");
  console.log(`Output: ${output} (${deduped.length} questions${warnings > 0 ? `, ${warnings} warnings` : ""})`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
