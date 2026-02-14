// ============================================================
// 解説分割ヘルパー関数
// ============================================================

// カタカナマーカー（ア．イ．ウ．...）で解説を分割（行政書士 組合せ問題用）
export const KANA_MARKERS = ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ'];

export function splitByKanaMarkers(text: string): Record<string, { explanation: string; isCorrect: boolean | null }> {
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
export function extractKanaStatements(questionText: string): Record<string, string> {
  const result: Record<string, string> = {};

  const pattern = new RegExp(
    `(${KANA_MARKERS.join('|')})[．.\\s]+(.*?)(?=(?:${KANA_MARKERS.join('|')})[．.\\s]|$)`,
    'gs'
  );

  let match;
  while ((match = pattern.exec(questionText)) !== null) {
    result[match[1]] = match[2].trim();
  }

  return result;
}

// 正誤判定: テキスト冒頭のキーワードから判定
export function detectCorrectness(text: string): boolean | null {
  const lower = text.slice(0, 30);
  // 否定系を先にチェック（「妥当でない」が「妥当」より前に判定されるように）
  if (/^(妥当でない|誤り|不適切|間違い|誤っている|不正解)/.test(lower)) return false;
  // 正しい系
  if (/^(正しい|妥当である|妥当|適切である|適切|正解)/.test(lower)) return true;
  return null;
}

// 労衛コン・診断士: 「選択肢別:」パターンで解説を分割
export function splitConsultantExplanation(explanation: string): { prefix: string; perChoice: Record<string, { text: string; isCorrect: boolean | null }> } {
  // 「選択肢別:」で分割
  const markerIdx = explanation.indexOf('選択肢別:');
  if (markerIdx === -1) {
    // 選択肢別マーカーがない場合、番号パターンで直接試す
    return { prefix: '', perChoice: splitByNumberedPattern(explanation) };
  }

  const prefix = explanation.slice(0, markerIdx).trim();
  const choicePart = explanation.slice(markerIdx + '選択肢別:'.length).trim();

  const perChoice: Record<string, { text: string; isCorrect: boolean | null }> = {};

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
export function splitByNumberedPattern(text: string): Record<string, { text: string; isCorrect: boolean | null }> {
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

// 番号パターン (1．妥当でない。... 2．正しい。...) で分割（行政書士の通常問題用）
// 「1．」「1、」「1.」のいずれにも対応
export function splitByJapaneseNumbered(text: string): { prefix: string; perChoice: Record<string, { text: string; isCorrect: boolean | null }> } {
  const result: Record<string, { text: string; isCorrect: boolean | null }> = {};

  // 「1．」「1、」「1.」で始まる位置を検出（文頭 or 直前が句点・空白等）
  const pattern = /(?:^|[。\s])(\d)[．.、,]\s*/g;
  const parts: { key: string; start: number; matchStart: number }[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    parts.push({ key: match[1], start: match.index + match[0].length, matchStart: match.index });
  }

  if (parts.length < 2) {
    return { prefix: '', perChoice: {} };
  }

  // 最初のマーカー前をprefixとして保存
  const prefix = parts[0].matchStart > 0 ? text.slice(0, parts[0].matchStart).trim() : '';

  for (let i = 0; i < parts.length; i++) {
    const end = i + 1 < parts.length ? parts[i + 1].matchStart : text.length;
    const segment = text.slice(parts[i].start, end).trim();
    const isCorrect = detectChoiceCorrectness(segment);
    result[parts[i].key] = { text: segment, isCorrect };
  }

  return { prefix, perChoice: result };
}

// 選択肢の正誤を判定
export function detectChoiceCorrectness(text: string): boolean | null {
  // 否定系を先にチェック（「妥当でない」が「妥当」より前に判定されるように）
  // 「明文で規定されていない」等の否定形も先にキャッチ
  if (/^(妥当でない|誤り|不正解|不適切|間違い|誤っている|含まれない|規定されていない|認められない|できない|ない|明文で規定されていない)/.test(text)) return false;
  if (/^(正しい|正解|妥当である|妥当|適切|含まれる|規定されている|認められる|明文で規定)/.test(text)) return true;
  return null;
}
