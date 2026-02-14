import { describe, it, expect } from 'vitest';
import {
  splitByKanaMarkers,
  extractKanaStatements,
  detectCorrectness,
  splitConsultantExplanation,
  splitByNumberedPattern,
  splitByJapaneseNumbered,
  detectChoiceCorrectness,
} from './examParsers';

// ============================================================
// detectCorrectness / detectChoiceCorrectness
// ============================================================

describe('detectCorrectness', () => {
  it('正しい系を検出', () => {
    expect(detectCorrectness('正しい。この規定は～')).toBe(true);
    expect(detectCorrectness('妥当である。条文の通り')).toBe(true);
    expect(detectCorrectness('適切である。判例により')).toBe(true);
  });

  it('間違い系を検出', () => {
    expect(detectCorrectness('誤り。この場合は～')).toBe(false);
    expect(detectCorrectness('妥当でない。条文上～')).toBe(false);
  });

  it('判定不能はnull', () => {
    expect(detectCorrectness('本問は民法の規定に～')).toBe(null);
  });
});

describe('detectChoiceCorrectness', () => {
  it('否定系を先にチェック（「妥当でない」が「妥当」に先行）', () => {
    expect(detectChoiceCorrectness('妥当でない。条文上～')).toBe(false);
    expect(detectChoiceCorrectness('妥当である。条文の通り')).toBe(true);
    expect(detectChoiceCorrectness('妥当。問題文の通り')).toBe(true);
  });

  it('追加キーワード', () => {
    expect(detectChoiceCorrectness('含まれない。この場合は')).toBe(false);
    expect(detectChoiceCorrectness('含まれる。判例により')).toBe(true);
    expect(detectChoiceCorrectness('規定されていない。')).toBe(false);
    expect(detectChoiceCorrectness('規定されている。')).toBe(true);
    expect(detectChoiceCorrectness('認められない。')).toBe(false);
    expect(detectChoiceCorrectness('認められる。')).toBe(true);
    expect(detectChoiceCorrectness('できない。')).toBe(false);
    expect(detectChoiceCorrectness('明文で規定されている条文')).toBe(true);
  });
});

// ============================================================
// splitByJapaneseNumbered（行政書士の通常問題 解説分割）
// ============================================================

describe('splitByJapaneseNumbered', () => {
  it('全角ピリオド (1．2．3．...) で分割できる', () => {
    // PROGRESS.md に記載されている実パターン
    const text = '1．含まれる。民法の規定により。2．明文で規定されていない。判例参照。3．正しい。条文の通り。';
    const result = splitByJapaneseNumbered(text);

    expect(Object.keys(result.perChoice)).toHaveLength(3);
    expect(result.perChoice['1']).toBeDefined();
    expect(result.perChoice['2']).toBeDefined();
    expect(result.perChoice['3']).toBeDefined();

    expect(result.perChoice['1'].text).toContain('含まれる');
    expect(result.perChoice['1'].isCorrect).toBe(true);

    expect(result.perChoice['2'].text).toContain('明文で規定されていない');
    expect(result.perChoice['2'].isCorrect).toBe(false);

    expect(result.perChoice['3'].text).toContain('正しい');
    expect(result.perChoice['3'].isCorrect).toBe(true);
  });

  it('半角ピリオドでも分割できる', () => {
    const text = '1. 誤り。この場合は適用されない。2. 正しい。条文の通り。';
    const result = splitByJapaneseNumbered(text);

    expect(Object.keys(result.perChoice)).toHaveLength(2);
    expect(result.perChoice['1'].isCorrect).toBe(false);
    expect(result.perChoice['2'].isCorrect).toBe(true);
  });

  it('読点区切り (1、2、...) で分割できる', () => {
    const text = '1、正しい。この規定は妥当。2、妥当でない。判例と異なる。3、誤り。条文にない。';
    const result = splitByJapaneseNumbered(text);

    expect(Object.keys(result.perChoice)).toHaveLength(3);
    expect(result.perChoice['1'].isCorrect).toBe(true);
    expect(result.perChoice['2'].isCorrect).toBe(false);
    expect(result.perChoice['3'].isCorrect).toBe(false);
  });

  it('句点後の番号開始にも対応', () => {
    // 実データでは「妥当でない。2．正しい。」のように句点の直後に次の番号が続く
    const text = '1．妥当でない。判例参照。2．正しい。条文の通り。3．妥当でない。以下の理由による。';
    const result = splitByJapaneseNumbered(text);

    expect(Object.keys(result.perChoice)).toHaveLength(3);
    expect(result.perChoice['1'].isCorrect).toBe(false);
    expect(result.perChoice['2'].isCorrect).toBe(true);
    expect(result.perChoice['3'].isCorrect).toBe(false);
  });

  it('prefix（前文）を正しく抽出', () => {
    const text = '本問は行政法の論点である。1．妥当でない。条文上明らかである。2．正しい。判例の通り。';
    const result = splitByJapaneseNumbered(text);

    expect(result.prefix).toBe('本問は行政法の論点である');
    expect(Object.keys(result.perChoice)).toHaveLength(2);
  });

  it('マーカーが1つしかない場合は空を返す', () => {
    const text = '1．この選択肢のみが正しい。';
    const result = splitByJapaneseNumbered(text);
    expect(Object.keys(result.perChoice)).toHaveLength(0);
  });

  it('5択問題の全分割', () => {
    const text = '1．妥当でない。2．妥当でない。3．正しい。これが正解。4．妥当でない。5．妥当でない。';
    const result = splitByJapaneseNumbered(text);

    expect(Object.keys(result.perChoice)).toHaveLength(5);
    expect(result.perChoice['3'].isCorrect).toBe(true);
    // 他は全部false
    for (const k of ['1', '2', '4', '5']) {
      expect(result.perChoice[k].isCorrect).toBe(false);
    }
  });
});

// ============================================================
// splitConsultantExplanation（労衛コン・診断士）
// ============================================================

describe('splitConsultantExplanation', () => {
  it('「選択肢別:」パターンで分割', () => {
    const text = '正解は3。選択肢別: 1:誤り。根拠条文なし。 / 2:誤り。前提が異なる。 / 3:正しい。条文の通り。 / 4:誤り。判例と異なる。';
    const result = splitConsultantExplanation(text);

    expect(result.prefix).toBe('正解は3。');
    expect(Object.keys(result.perChoice)).toHaveLength(4);
    expect(result.perChoice['1'].isCorrect).toBe(false);
    expect(result.perChoice['3'].isCorrect).toBe(true);
    expect(result.perChoice['3'].text).toContain('正しい');
  });

  it('「選択肢別:」がない場合、番号パターンで直接分割を試みる', () => {
    const text = '1:誤り。不正解。 / 2:正しい。条文の通り。';
    const result = splitConsultantExplanation(text);

    expect(result.prefix).toBe('');
    expect(Object.keys(result.perChoice)).toHaveLength(2);
    expect(result.perChoice['1'].isCorrect).toBe(false);
    expect(result.perChoice['2'].isCorrect).toBe(true);
  });

  it('英字キーにも対応', () => {
    const text = '選択肢別: A:誤り。 / B:正しい。 / C:誤り。';
    const result = splitConsultantExplanation(text);

    expect(Object.keys(result.perChoice)).toHaveLength(3);
    expect(result.perChoice['A'].isCorrect).toBe(false);
    expect(result.perChoice['B'].isCorrect).toBe(true);
  });

  it('カタカナキーにも対応', () => {
    const text = '選択肢別: ア:正しい。 / イ:誤り。';
    const result = splitConsultantExplanation(text);

    expect(Object.keys(result.perChoice)).toHaveLength(2);
    expect(result.perChoice['ア'].isCorrect).toBe(true);
    expect(result.perChoice['イ'].isCorrect).toBe(false);
  });
});

// ============================================================
// splitByNumberedPattern
// ============================================================

describe('splitByNumberedPattern', () => {
  it('「/」区切りで番号パターン分割', () => {
    const text = '1:誤り。説明文。 / 2:正しい。条文参照。 / 3:誤り。前提が違う。';
    const result = splitByNumberedPattern(text);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['1'].isCorrect).toBe(false);
    expect(result['2'].isCorrect).toBe(true);
    expect(result['3'].isCorrect).toBe(false);
  });

  it('マッチしないテキストは空', () => {
    const text = 'この解説は分割パターンに該当しません。';
    const result = splitByNumberedPattern(text);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ============================================================
// splitByKanaMarkers（行政書士 組合せ問題 解説）
// ============================================================

describe('splitByKanaMarkers', () => {
  it('全角ピリオドでカタカナ区切り分割', () => {
    const text = 'ア．正しい。民法の規定の通り。イ．誤り。判例と異なる。ウ．正しい。条文参照。';
    const result = splitByKanaMarkers(text);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['ア'].isCorrect).toBe(true);
    expect(result['イ'].isCorrect).toBe(false);
    expect(result['ウ'].isCorrect).toBe(true);
  });

  it('半角ピリオドでも分割', () => {
    const text = 'ア.正しい。条文参照。イ.誤り。判例と異なる。';
    const result = splitByKanaMarkers(text);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['ア'].isCorrect).toBe(true);
    expect(result['イ'].isCorrect).toBe(false);
  });

  it('マーカーがない場合は空', () => {
    const text = 'この解説にはカタカナマーカーがありません。';
    const result = splitByKanaMarkers(text);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ============================================================
// extractKanaStatements（行政書士 組合せ問題 問題文）
// ============================================================

describe('extractKanaStatements', () => {
  it('カタカナ付き記述を抽出', () => {
    const text = '次の記述のうち正しいものはどれか。ア．甲は乙に対して債権を有する。イ．丙は丁に対して義務を負う。ウ．戊は己に対する責任がない。';
    const result = extractKanaStatements(text);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['ア']).toContain('甲は乙に対して債権を有する');
    expect(result['イ']).toContain('丙は丁に対して義務を負う');
    expect(result['ウ']).toContain('戊は己に対する責任がない');
  });

  it('空白区切りのパターン', () => {
    const text = '次の記述について。ア 甲が乙に申し込んだ場合。イ 丙が丁に請求した場合。';
    const result = extractKanaStatements(text);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['ア']).toContain('甲が乙に申し込んだ場合');
  });
});

// ============================================================
// 実データに近いE2Eパターンテスト
// ============================================================

describe('行政書士 実データ解説パターン', () => {
  it('実際の全角ピリオド解説が正しく分割される', () => {
    // PROGRESS.md に記載: 「1．含まれる。…」「2．明文で規定されていない。…」
    const explanation = '1．含まれる。民法第177条に規定されている不動産物権変動の対抗要件に関する問題である。2．明文で規定されていない。民法にはこのような規定は存在しない。3．正しい。判例（最判昭和46年6月22日）の通りである。4．妥当でない。行政法上の解釈として認められない。5．誤り。前提条件が異なる。';
    const result = splitByJapaneseNumbered(explanation);

    expect(Object.keys(result.perChoice)).toHaveLength(5);
    expect(result.perChoice['1'].isCorrect).toBe(true); // 含まれる → true
    expect(result.perChoice['2'].isCorrect).toBe(false); // 明文で規定されていない → 追加キーワードで判定
    expect(result.perChoice['3'].isCorrect).toBe(true); // 正しい
    expect(result.perChoice['4'].isCorrect).toBe(false); // 妥当でない
    expect(result.perChoice['5'].isCorrect).toBe(false); // 誤り
  });
});

describe('労衛コン 実データ解説パターン', () => {
  it('「選択肢別:」で5択分割', () => {
    const explanation = '正解は(3)。労働安全衛生法に基づく規定に関する問題。選択肢別: 1:誤り。事業者ではなく安全管理者の職務。 / 2:誤り。50人以上ではなく100人以上の事業場に適用。 / 3:正しい。法第12条の規定通り。 / 4:誤り。産業医の選任要件と異なる。 / 5:誤り。衛生管理者の要件と混同。';
    const result = splitConsultantExplanation(explanation);

    expect(result.prefix).toContain('正解は(3)');
    expect(Object.keys(result.perChoice)).toHaveLength(5);
    expect(result.perChoice['3'].isCorrect).toBe(true);
    expect(result.perChoice['1'].isCorrect).toBe(false);
  });
});
