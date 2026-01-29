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

type ExamType = 'sharoushi' | 'gyouseishosi' | 'auto';

export function ImportExam({ deckId, onBack }: ImportExamProps) {
  const { importCards, getCardsForDeck } = useStore();
  const [examType, setExamType] = useState<ExamType>('auto');
  const [preview, setPreview] = useState<Array<{ front: string; back: string; type: 'true_false' | 'multiple_choice'; correctAnswer?: boolean; options?: CardOption[] }>>([]);
  const [importStatus, setImportStatus] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCards = getCardsForDeck(deckId);

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
    return 'auto';
  };

  const parseSharoushiData = (data: SharoushiQuestion[]) => {
    const cards: Array<{ front: string; back: string; type: 'true_false'; correctAnswer: boolean }> = [];

    for (const question of data) {
      for (const option of question.options) {
        const front = `【${question.year}年 ${question.subject_name} 問${question.question_number}${option.option_letter}】\n\n${option.question_text}`;
        const explanation = option.point
          ? `【ポイント】${option.point}\n\n【解説】${option.explanation}`
          : option.explanation;

        cards.push({
          front,
          back: explanation,
          type: 'true_false',
          correctAnswer: option.is_correct,
        });
      }
    }

    return cards;
  };

  const parseGyouseishosiData = (data: GyouseishosiQuestion[]) => {
    const cards: Array<{ front: string; back: string; type: 'multiple_choice'; options: CardOption[] }> = [];

    for (const question of data) {
      const front = `【${question.year} ${question.question_number}】[${question.subject}${question.sub_category ? ` - ${question.sub_category}` : ''}]\n\n${question.question_text}`;

      const options: CardOption[] = question.choices.map((choice) => ({
        id: `${question.que_id}-${choice.number}`,
        text: `${choice.number}. ${choice.text}`,
        isCorrect: choice.number.toString() === question.correct_answer,
      }));

      cards.push({
        front,
        back: question.explanation,
        type: 'multiple_choice',
        options,
      });
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

      let parsedCards;
      if (detectedType === 'sharoushi') {
        parsedCards = parseSharoushiData(data as SharoushiQuestion[]);
        setImportStatus(`社労士試験形式: ${parsedCards.length}問を検出しました`);
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

    importCards(deckId, preview);
    setImportStatus(`✓ ${preview.length}問をインポートしました！`);
    setPreview([]);
    setFileName('');
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
            <option value="gyouseishosi">行政書士試験（多肢選択）</option>
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
              📁 JSONファイルを選択
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
            <div className="import-exam__preview">
              <h3>プレビュー（最初の3問）</h3>
              <div className="import-exam__preview-cards">
                {preview.slice(0, 3).map((card, index) => (
                  <div key={index} className="import-exam__preview-card">
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
              ✓ {preview.length}問をインポート
            </button>
          </>
        )}
      </div>
    </div>
  );
}
