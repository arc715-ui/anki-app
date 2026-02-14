import { useState, useRef } from 'react';
import { useStore } from '../stores/useStore';
import type { CardOption } from '../types';

interface ImportExamProps {
  deckId: string;
  onBack: () => void;
}

// 社労士試験のJSON形式
interface SharoushiOption {
  option_letter: string;
  question_id: number;
  question_text: string;
  is_correct: boolean;
  point: string;
  explanation: string;
  difficulty?: string;
  source?: string;
  correct_rate?: string;
}

interface SharoushiQuestion {
  year: number;
  subject_id: number;
  subject_name: string;
  question_number: number;
  options: SharoushiOption[];
}

// 行政書士試験のJSON形式
interface GyouseishosiChoice {
  number: number;
  text: string;
}

interface GyouseishosiQuestion {
  que_id: number;
  year: string;
  question_number: string;
  subject: string;
  sub_category: string;
  question_text: string;
  choices: GyouseishosiChoice[];
  correct_answer: string;
  explanation: string;
}

// 労働衛生コンサルタント試験のJSON形式
interface ConsultantQuestion {
  year: number;
  q_no: number;
  exam: string;
  subject: string;
  law_detail: string;
  question_type: string;
  question: string;
  choices: Record<string, string>;
  answer: string;
  explanation: string;
}

// 中小企業診断士試験のJSON形式
interface ShindanshiQuestion {
  year: number | string;
  subject: string;
  question_number: number | string;
  question_text: string;
  choices: Record<string, string>;
  correct_answer: string;
  explanation: string;
  sub_category?: string;
  difficulty?: string;
}

type ExamType = 'sharoushi' | 'gyouseishosi' | 'consultant' | 'shindanshi' | 'auto';

// ============================================================
// 解説分割ヘルパー関数
// ============================================================

// カタカナマーカー（ア．イ．ウ．...）で解説を分割（行政書士 組合せ問題用）
const KANA_MARKERS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'];

function splitByKanaMarkers(text: string): Record<string, { explanation: string; isCorrect: boolean | null }> {
  const result: Record<string, { explanation: string; isCorrect: boolean | null }> = {};

  // パターン: ア．～ or ア. ～ (全角・半角ピリオド対応)
  const pattern = new RegExp(
    `(${KANA_MARKERS.join('|')})[．.]\\s*`,
    'g'
  );

  const parts: { marker: string; start: number }[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    parts.push({ marker: match[1], start: match.index + match[0].length });
  }

  for (let i = 0; i < parts.length; i++) {
    const end = i + 1 < parts.length
      ? text.lastIndexOf(parts[i + 1].marker, parts[i + 1].start)
      : text.length;
    const segment = text.slice(parts[i].start, end).trim();

    // 正誤判定キーワード
    const isCorrect = detectCorrectness(segment);

    result[parts[i].marker] = { explanation: segment, isCorrect };
  }

  return result;
}

// question_text からカタカナ付き記述（ア～オ）を抽出（行政書士 組合せ問題用）
function extractKanaStatements(questionText: string): Record<string, string> {
  const result: Record<string, string> = {};

  const pattern = new RegExp(
    `(${KANA_MARKERS.join('|')})[．.\\s]+(.*?)(?=(?:${KANA_MARKERS.join('|')})[．.]|$)`,
    'gs'
  );

  let match;
  while ((match = pattern.exec(questionText)) !== null) {
    result[match[1]] = match[2].trim();
  }

  return result;
}

// 正誤判定: テキスト冒頭のキーワードから判定
function detectCorrectness(text: string): boolean | null {
  const lower = text.slice(0, 30);
  // 正しい系
  if (/^(正しい|妥当である|妥当|適切である|適切|正解)/.test(lower)) return true;
  // 間違い系
  if (/^(誤り|妥当でない|不適切|間違い|誤っている|不正解)/.test(lower)) return false;
  return null;
}

// 行政書士の組合せ問題かどうかを判定
function isComboQuestion(question: GyouseishosiQuestion): boolean {
  // 選択肢が「ア・イ」のようなカタカナの組合せかどうか
  if (question.choices.length === 0) return false;
  const firstChoiceText = question.choices[0].text;
  // 「ア・イ」「ア・ウ」のようなパターン
  return /^[アイウエオカキクケコ][・、][アイウエオカキクケコ]/.test(firstChoiceText);
}

// 労衛コン・診断士: 「選択肢別:」パターンで解説を分割
function splitConsultantExplanation(explanation: string): { prefix: string; perChoice: Record<string, { text: string; isCorrect: boolean | null }> } {
  const perChoice: Record<string, { text: string; isCorrect: boolean | null }> = {};

  // 「選択肢別:」で分割
  const markerIdx = explanation.indexOf('選択肢別:');
  if (markerIdx === -1) {
    // 選択肢別マーカーがない場合、番号パターンで直接試す
    return { prefix: '', perChoice: splitByNumberedPattern(explanation) };
  }

  const prefix = explanation.slice(0, markerIdx).trim();
  const choicePart = explanation.slice(markerIdx + '選択肢別:'.length).trim();

  // 「 / 」で分割 → 各セグメントは「1:誤り。～」形式
  const segments = choicePart.split(/\s*\/\s*/);
  for (const seg of segments) {
    const m = seg.match(/^(\d+|[A-Eア-オa-e]):(.+)/s);
    if (m) {
      const key = m[1];
      const content = m[2].trim();
      const isCorrect = detectChoiceCorrectness(content);
      perChoice[key] = { text: content, isCorrect };
    }
  }

  return { prefix, perChoice };
}

// 番号パターン (1:～ / 2:～) で分割を試みる
function splitByNumberedPattern(text: string): Record<string, { text: string; isCorrect: boolean | null }> {
  const result: Record<string, { text: string; isCorrect: boolean | null }> = {};
  // パターン: 「1:」「2:」...で始まるセグメント、「 / 」区切り
  const segments = text.split(/\s*\/\s*/);
  for (const seg of segments) {
    const m = seg.match(/^(\d+|[A-Eア-オa-e]):(.+)/s);
    if (m) {
      const key = m[1];
      const content = m[2].trim();
      const isCorrect = detectChoiceCorrectness(content);
      result[key] = { text: content, isCorrect };
    }
  }
  return result;
}

// 番号+読点パターン (1、正しい。... 2、誤り。...) で分割（行政書士の通常問題用）
function splitByJapaneseNumbered(text: string): { prefix: string; perChoice: Record<string, { text: string; isCorrect: boolean | null }> } {
  const result: Record<string, { text: string; isCorrect: boolean | null }> = {};

  // 「1、」「2、」...で始まる位置を検出
  const pattern = /(?:^|\s)(\d)[、,]\s*/g;
  const parts: { key: string; start: number }[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    parts.push({ key: match[1], start: match.index + match[0].length });
  }

  if (parts.length < 2) {
    return { prefix: '', perChoice: {} };
  }

  // 最初のマーカー前をprefixとして保存
  const firstMatchStart = text.indexOf(parts[0].key + '、');
  const prefix = firstMatchStart > 0 ? text.slice(0, firstMatchStart).trim() : '';

  for (let i = 0; i < parts.length; i++) {
    const end = i + 1 < parts.length
      ? text.lastIndexOf(parts[i + 1].key + '、', parts[i + 1].start)
      : text.length;
    const segment = text.slice(parts[i].start, end).trim();
    const isCorrect = detectChoiceCorrectness(segment);
    result[parts[i].key] = { text: segment, isCorrect };
  }

  return { prefix, perChoice: result };
}

// 選択肢の正誤を判定
function detectChoiceCorrectness(text: string): boolean | null {
  if (/^正しい/.test(text)) return true;
  if (/^誤り/.test(text)) return false;
  if (/^正解/.test(text)) return true;
  if (/^不正解/.test(text)) return false;
  if (/^妥当である/.test(text)) return true;
  if (/^妥当でない/.test(text)) return false;
  if (/^適切/.test(text)) return true;
  if (/^不適切/.test(text)) return false;
  return null;
}

interface ParsedCard {
  front: string;
  back: string;
  type: 'true_false' | 'multiple_choice';
  correctAnswer?: boolean;
  options?: CardOption[];
  difficulty?: string;
  correctRate?: number;
  source?: string;
  point?: string;
  subject?: string;
  subCategory?: string;
}

export function ImportExam({ deckId, onBack }: ImportExamProps) {
  const { importCards, importCardsToMultipleDecks, getCardsForDeck, decks } = useStore();
  const [examType, setExamType] = useState<ExamType>('auto');
  const [preview, setPreview] = useState<ParsedCard[]>([]);
  const [importStatus, setImportStatus] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [splitBySubject, setSplitBySubject] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCards = getCardsForDeck(deckId);
  const currentDeck = decks.find((d) => d.id === deckId);

  // 科目一覧を取得
  const detectedSubjects = [...new Set(preview.filter((c) => c.subject).map((c) => c.subject!))];

  const detectExamType = (data: unknown[]): ExamType => {
    if (data.length === 0) return 'auto';
    const first = data[0] as Record<string, unknown>;

    // 社労士: options配列がある
    if ('options' in first && Array.isArray(first.options)) {
      return 'sharoushi';
    }
    // 行政書士: choices配列がある
    if ('choices' in first && Array.isArray(first.choices)) {
      return 'gyouseishosi';
    }
    // コンサルタント: choicesがオブジェクト + q_noがある
    if ('q_no' in first && 'choices' in first && typeof first.choices === 'object' && !Array.isArray(first.choices)) {
      return 'consultant';
    }
    // 中小企業診断士: choicesがオブジェクト + correct_answer + question_text
    if ('question_text' in first && 'correct_answer' in first && 'choices' in first && typeof first.choices === 'object' && !Array.isArray(first.choices)) {
      return 'shindanshi';
    }
    return 'auto';
  };

  const parseSharoushiData = (data: SharoushiQuestion[]): ParsedCard[] => {
    const cards: ParsedCard[] = [];

    for (const question of data) {
      for (const option of question.options) {
        const front = `【${question.year}年 ${question.subject_name} 問${question.question_number}${option.option_letter}】\n\n${option.question_text}`;
        const explanation = option.explanation || '';

        const correctRate = option.correct_rate ? parseFloat(option.correct_rate) : undefined;

        cards.push({
          front,
          back: explanation,
          type: 'true_false',
          correctAnswer: option.is_correct,
          difficulty: option.difficulty,
          correctRate: correctRate != null && !isNaN(correctRate) ? correctRate : undefined,
          source: option.source,
          point: option.point,
          subject: question.subject_name,
        });
      }
    }

    return cards;
  };

  const parseGyouseishosiData = (data: GyouseishosiQuestion[]): ParsedCard[] => {
    const cards: ParsedCard[] = [];

    for (const question of data) {
      if (isComboQuestion(question)) {
        // ===== 組合せ問題: ア～オの個別記述を一問一答化 =====
        const statements = extractKanaStatements(question.question_text);
        const explanations = splitByKanaMarkers(question.explanation);

        // 問題文からア～オ部分を除いた前文（共通の問い）
        const firstKanaIdx = question.question_text.search(
          new RegExp(`(${KANA_MARKERS.join('|')})[．.]`)
        );
        const commonPrefix = firstKanaIdx > 0
          ? question.question_text.slice(0, firstKanaIdx).trim()
          : '';

        for (const [kana, statement] of Object.entries(statements)) {
          const expData = explanations[kana];
          const explanation = expData?.explanation || question.explanation;
          const isCorrect = expData?.isCorrect;

          const front = `【${question.year} ${question.question_number}-${kana}】[${question.subject}${question.sub_category ? ` - ${question.sub_category}` : ''}]\n\n${commonPrefix ? commonPrefix + '\n\n' : ''}▼ ${kana}\n${statement}`;

          cards.push({
            front,
            back: explanation,
            type: 'true_false',
            correctAnswer: isCorrect ?? undefined as unknown as boolean,
            subject: question.subject,
            subCategory: question.sub_category,
          });
        }
      } else {
        // ===== 通常問題: 各選択肢を一問一答化（解説も分割を試みる） =====
        // まずカタカナ分割を試行、失敗なら番号+読点パターン、さらにコンサル形式を試行
        const kanaExplanations = splitByKanaMarkers(question.explanation);
        const hasKanaExp = Object.keys(kanaExplanations).length > 0;

        const numberedExp = !hasKanaExp ? splitByJapaneseNumbered(question.explanation) : null;
        const hasNumberedExp = numberedExp ? Object.keys(numberedExp.perChoice).length > 0 : false;

        const consultantExp = !hasKanaExp && !hasNumberedExp ? splitConsultantExplanation(question.explanation) : null;
        const hasConsultantExp = consultantExp ? Object.keys(consultantExp.perChoice).length > 0 : false;

        for (const choice of question.choices) {
          const isCorrect = choice.number.toString() === question.correct_answer;
          const front = `【${question.year} ${question.question_number}-${choice.number}】[${question.subject}${question.sub_category ? ` - ${question.sub_category}` : ''}]\n\n${question.question_text}\n\n▼ 選択肢 ${choice.number}\n${choice.text}`;

          let back = question.explanation;
          const choiceKey = choice.number.toString();

          if (hasKanaExp) {
            // カタカナ対応（1→ア, 2→イ, ...）
            const kanaKey = KANA_MARKERS[choice.number - 1];
            if (kanaKey && kanaExplanations[kanaKey]) {
              back = kanaExplanations[kanaKey].explanation;
            }
          } else if (hasNumberedExp && numberedExp!.perChoice[choiceKey]) {
            // 番号+読点パターン（1、正しい。...）
            const prefix = numberedExp!.prefix;
            back = (prefix ? prefix + '\n\n' : '') + numberedExp!.perChoice[choiceKey].text;
          } else if (hasConsultantExp && consultantExp!.perChoice[choiceKey]) {
            // コンサル形式（選択肢別: 1:誤り。...）
            const prefix = consultantExp!.prefix;
            back = (prefix ? prefix + '\n\n' : '') + consultantExp!.perChoice[choiceKey].text;
          }

          cards.push({
            front,
            back,
            type: 'true_false',
            correctAnswer: isCorrect,
            subject: question.subject,
            subCategory: question.sub_category,
          });
        }
      }
    }

    return cards;
  };

  const parseConsultantData = (data: ConsultantQuestion[]): ParsedCard[] => {
    const cards: ParsedCard[] = [];

    for (const question of data) {
      // 記述式・穴埋め式はスキップ
      if (question.question_type === '記述式' || question.question_type === '穴埋め') continue;

      // 解説を選択肢別に分割
      const { prefix, perChoice } = splitConsultantExplanation(question.explanation);
      const hasPerChoiceExp = Object.keys(perChoice).length > 0;

      const choiceEntries = Object.entries(question.choices);
      for (const [key, text] of choiceEntries) {
        const isCorrect = key === question.answer;

        // 選択肢ごとの解説を取得
        const choiceExp = hasPerChoiceExp ? perChoice[key] : null;
        const back = choiceExp
          ? (prefix ? prefix + '\n\n' : '') + choiceExp.text
          : question.explanation;

        const front = `【${question.year}年 ${question.subject} 問${question.q_no}-${key}】[${question.law_detail}]\n\n${question.question}\n\n▼ 選択肢 ${key}\n${text}`;

        cards.push({
          front,
          back,
          type: 'true_false',
          correctAnswer: isCorrect,
          subject: question.subject,
          subCategory: question.law_detail,
        });
      }
    }

    return cards;
  };

  const parseShindanshiData = (data: ShindanshiQuestion[]): ParsedCard[] => {
    const cards: ParsedCard[] = [];

    for (const question of data) {
      const year = typeof question.year === 'number' ? `${question.year}年` : question.year;
      const qNum = typeof question.question_number === 'number' ? `問${question.question_number}` : question.question_number;

      // 解説を選択肢別に分割を試みる
      const { prefix, perChoice } = splitConsultantExplanation(question.explanation);
      const hasPerChoiceExp = Object.keys(perChoice).length > 0;

      const choiceEntries = Object.entries(question.choices);
      for (const [key, text] of choiceEntries) {
        const isCorrect = key === question.correct_answer;

        // 選択肢ごとの解説を取得
        const choiceExp = hasPerChoiceExp ? perChoice[key] : null;
        const back = choiceExp
          ? (prefix ? prefix + '\n\n' : '') + choiceExp.text
          : question.explanation;

        const front = `【${year} ${question.subject} ${qNum}-${key}】${question.sub_category ? `[${question.sub_category}]` : ''}\n\n${question.question_text}\n\n▼ 選択肢 ${key}\n${text}`;

        cards.push({
          front,
          back,
          type: 'true_false',
          correctAnswer: isCorrect,
          difficulty: question.difficulty,
          subject: question.subject,
          subCategory: question.sub_category,
        });
      }
    }

    return cards;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus('読み込み中...');

    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown[];

      const detectedType = examType === 'auto' ? detectExamType(data) : examType;

      if (detectedType === 'auto') {
        setImportStatus('エラー: ファイル形式を判別できません');
        return;
      }

      let parsedCards: ParsedCard[];
      if (detectedType === 'sharoushi') {
        parsedCards = parseSharoushiData(data as SharoushiQuestion[]);
        setImportStatus(`社労士試験形式: ${parsedCards.length}問を検出しました`);
      } else if (detectedType === 'consultant') {
        parsedCards = parseConsultantData(data as ConsultantQuestion[]);
        setImportStatus(`コンサルタント試験形式: ${parsedCards.length}問を検出しました`);
      } else if (detectedType === 'shindanshi') {
        parsedCards = parseShindanshiData(data as ShindanshiQuestion[]);
        setImportStatus(`中小企業診断士試験形式: ${parsedCards.length}問を検出しました`);
      } else {
        parsedCards = parseGyouseishosiData(data as GyouseishosiQuestion[]);
        setImportStatus(`行政書士試験形式: ${parsedCards.length}問を検出しました`);
      }

      setPreview(parsedCards);
    } catch (error) {
      setImportStatus(`エラー: ${error instanceof Error ? error.message : 'ファイルの読み込みに失敗しました'}`);
      setPreview([]);
    }
  };

  const handleImport = () => {
    if (preview.length === 0) return;

    if (splitBySubject && detectedSubjects.length > 1) {
      // 科目ごとにデッキ分割
      const grouped: Record<string, ParsedCard[]> = {};
      for (const card of preview) {
        const key = card.subject || '未分類';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(card);
      }
      const baseName = currentDeck?.name || 'インポート';
      const color = currentDeck?.color || '#6366f1';
      importCardsToMultipleDecks(baseName, color, grouped);
      setImportStatus(`✓ ${detectedSubjects.length}科目・${preview.length}問をインポートしました！`);
    } else {
      // 1デッキにまとめてインポート
      importCards(deckId, preview);
      setImportStatus(`✓ ${preview.length}問をインポートしました！`);
    }

    setPreview([]);
    setFileName('');
    setSplitBySubject(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="import-exam">
      <header className="import-exam__header">
        <button className="btn btn--icon" onClick={onBack}>
          ← 戻る
        </button>
        <h2>試験問題をインポート</h2>
      </header>

      <div className="import-exam__content">
        <div className="import-exam__info">
          <p>現在のカード数: <strong>{existingCards.length}</strong></p>
        </div>

        <div className="import-exam__type-select">
          <label>ファイル形式:</label>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value as ExamType)}
            className="import-exam__select"
          >
            <option value="auto">自動検出</option>
            <option value="sharoushi">社労士試験（◯✕形式）</option>
            <option value="gyouseishosi">行政書士試験（一問一答）</option>
            <option value="consultant">コンサルタント試験（一問一答）</option>
            <option value="shindanshi">中小企業診断士（一問一答）</option>
          </select>
        </div>

        <div className="import-exam__file-input">
          <label className="import-exam__file-label">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="import-exam__file"
            />
            <span className="btn btn--primary">
              JSONファイルを選択
            </span>
          </label>
          {fileName && <span className="import-exam__filename">{fileName}</span>}
        </div>

        {importStatus && (
          <div className={`import-exam__status ${importStatus.startsWith('エラー') ? 'import-exam__status--error' : importStatus.startsWith('✓') ? 'import-exam__status--success' : ''}`}>
            {importStatus}
          </div>
        )}

        {preview.length > 0 && (
          <>
            {/* 科目分割オプション */}
            {detectedSubjects.length > 1 && (
              <div className="import-exam__option">
                <label className="import-exam__option-label">
                  <input
                    type="checkbox"
                    checked={splitBySubject}
                    onChange={(e) => setSplitBySubject(e.target.checked)}
                  />
                  <span>科目ごとにデッキを分割（{detectedSubjects.length}科目検出）</span>
                </label>
                {splitBySubject && (
                  <div className="import-exam__subject-list">
                    {detectedSubjects.map((subj) => {
                      const count = preview.filter((c) => c.subject === subj).length;
                      return (
                        <span key={subj} className="import-exam__subject-tag">
                          {subj} ({count})
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="import-exam__preview">
              <h3>プレビュー（最初の3問）</h3>
              <div className="import-exam__preview-cards">
                {preview.slice(0, 3).map((card, index) => (
                  <div key={index} className="import-exam__preview-card">
                    {card.subject && (
                      <span className="import-exam__preview-subject">{card.subject}</span>
                    )}
                    <div className="import-exam__preview-front">
                      <strong>問題:</strong>
                      <pre>{card.front.slice(0, 200)}...</pre>
                    </div>
                    <div className="import-exam__preview-back">
                      <strong>解説:</strong>
                      <pre>{card.back.slice(0, 150)}...</pre>
                    </div>
                    <div className="import-exam__preview-type">
                      タイプ: {card.type === 'true_false' ? `◯✕（正解: ${card.correctAnswer ? '◯' : '✕'}）` : `多肢選択（${card.options?.length}択）`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn btn--primary btn--large"
              onClick={handleImport}
            >
              {splitBySubject && detectedSubjects.length > 1
                ? `✓ ${detectedSubjects.length}科目・${preview.length}問をインポート`
                : `✓ ${preview.length}問をインポート`
              }
            </button>
          </>
        )}
      </div>
    </div>
  );
}
