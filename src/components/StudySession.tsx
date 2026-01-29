import { useState, useCallback } from 'react';
import { useStore } from '../stores/useStore';
import type { Card, Quality, CardOption } from '../types';
import { getQualityLabel, calculateNextReview } from '../lib/sm2';

interface StudySessionProps {
  deckId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function StudySession({ deckId, onComplete, onBack }: StudySessionProps) {
  const { getDueCardsForDeck, reviewCardAction, recordSession, decks } = useStore();

  const deck = decks.find((d) => d.id === deckId);
  const dueCards = getDueCardsForDeck(deckId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionCards] = useState<Card[]>(() => [...dueCards]);

  // For multiple choice / true-false
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(null);
  const [showResult, setShowResult] = useState(false);

  const currentCard = sessionCards[currentIndex];
  const totalCards = sessionCards.length;

  const handleFlip = useCallback(() => {
    if (currentCard?.type === 'flashcard') {
      setIsFlipped((prev) => !prev);
    }
  }, [currentCard?.type]);

  const handleRate = useCallback((quality: Quality) => {
    if (!currentCard) return;

    reviewCardAction(currentCard.id, quality);
    setStudiedCount((prev) => prev + 1);
    if (quality >= 3) {
      setCorrectCount((prev) => prev + 1);
    }

    // Reset state for next card
    setSelectedAnswer(null);
    setShowResult(false);
    setIsFlipped(false);

    if (currentIndex < totalCards - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      recordSession(deckId, studiedCount + 1, correctCount + (quality >= 3 ? 1 : 0));
      onComplete();
    }
  }, [currentCard, currentIndex, totalCards, reviewCardAction, recordSession, deckId, studiedCount, correctCount, onComplete]);

  const handleTrueFalseAnswer = (answer: boolean) => {
    setSelectedAnswer(answer);
    setShowResult(true);
  };

  const handleMultipleChoiceAnswer = (optionId: string) => {
    setSelectedAnswer(optionId);
    setShowResult(true);
  };

  const isAnswerCorrect = (): boolean => {
    if (!currentCard) return false;

    if (currentCard.type === 'true_false') {
      return selectedAnswer === currentCard.correctAnswer;
    }

    if (currentCard.type === 'multiple_choice') {
      const correctOption = currentCard.options?.find(o => o.isCorrect);
      return selectedAnswer === correctOption?.id;
    }

    return false;
  };

  const getIntervalText = (quality: Quality): string => {
    if (!currentCard) return '';
    const result = calculateNextReview(quality, currentCard.repetition, currentCard.easeFactor, currentCard.interval);
    if (result.interval === 1) return '1日後';
    if (result.interval < 30) return `${result.interval}日後`;
    if (result.interval < 365) return `${Math.round(result.interval / 30)}ヶ月後`;
    return `${Math.round(result.interval / 365)}年後`;
  };

  // No cards to study
  if (totalCards === 0) {
    return (
      <div className="study-complete">
        <div className="study-complete__icon">🎉</div>
        <h2 className="study-complete__title">復習完了！</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>今日の復習カードはありません</p>
        <button className="btn btn--primary" onClick={onBack}>ホームに戻る</button>
      </div>
    );
  }

  // Session complete
  if (currentIndex >= totalCards) {
    const percentage = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
    return (
      <div className="study-complete">
        <div className="study-complete__icon">🏆</div>
        <h2 className="study-complete__title">セッション完了！</h2>
        <div className="study-complete__stats">
          <div className="study-complete__stat">
            <div className="study-complete__stat-value">{studiedCount}</div>
            <div className="study-complete__stat-label">学習した枚数</div>
          </div>
          <div className="study-complete__stat">
            <div className="study-complete__stat-value">{percentage}%</div>
            <div className="study-complete__stat-label">正解率</div>
          </div>
        </div>
        <button className="btn btn--primary btn--full" onClick={onBack}>ホームに戻る</button>
      </div>
    );
  }

  const renderFlashcard = () => (
    <>
      <div className={`flashcard ${isFlipped ? 'flashcard--flipped' : ''}`} onClick={handleFlip}>
        <div className="flashcard__inner">
          <div className="flashcard__face flashcard__face--front">
            <span className="flashcard__label">問題</span>
            {currentCard.front}
          </div>
          <div className="flashcard__face flashcard__face--back">
            <span className="flashcard__label">答え</span>
            {currentCard.back}
          </div>
        </div>
      </div>
      {isFlipped ? (
        <div className="rating-buttons">
          <button className="rating-btn rating-btn--fail" onClick={() => handleRate(1)}>
            <span>{getQualityLabel(1)}</span>
            <span className="rating-btn__days">{getIntervalText(1)}</span>
          </button>
          <button className="rating-btn rating-btn--hard" onClick={() => handleRate(3)}>
            <span>{getQualityLabel(3)}</span>
            <span className="rating-btn__days">{getIntervalText(3)}</span>
          </button>
          <button className="rating-btn rating-btn--good" onClick={() => handleRate(5)}>
            <span>{getQualityLabel(5)}</span>
            <span className="rating-btn__days">{getIntervalText(5)}</span>
          </button>
        </div>
      ) : (
        <p className="study-hint">タップして答えを表示</p>
      )}
    </>
  );

  const renderTrueFalse = () => (
    <>
      <div className="question-card">
        <span className="question-card__type">⭕ 正誤問題</span>
        <div className="question-card__text">{currentCard.front}</div>
      </div>

      {!showResult ? (
        <div className="tf-answer-buttons">
          <button className="tf-answer-btn tf-answer-btn--true" onClick={() => handleTrueFalseAnswer(true)}>
            <span className="tf-answer-btn__icon">⭕</span>
            <span>正しい</span>
          </button>
          <button className="tf-answer-btn tf-answer-btn--false" onClick={() => handleTrueFalseAnswer(false)}>
            <span className="tf-answer-btn__icon">❌</span>
            <span>間違い</span>
          </button>
        </div>
      ) : (
        <div className="answer-result">
          <div className={`answer-result__badge ${isAnswerCorrect() ? 'answer-result__badge--correct' : 'answer-result__badge--wrong'}`}>
            {isAnswerCorrect() ? '✓ 正解！' : '✗ 不正解'}
          </div>
          <p className="answer-result__text">正解: {currentCard.correctAnswer ? '正しい' : '間違い'}</p>
          <div className="rating-buttons">
            <button className="rating-btn rating-btn--fail" onClick={() => handleRate(isAnswerCorrect() ? 3 : 1)}>
              <span>次へ</span>
              <span className="rating-btn__days">{getIntervalText(isAnswerCorrect() ? 3 : 1)}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );

  const renderMultipleChoice = () => (
    <>
      <div className="question-card">
        <span className="question-card__type">🔢 多肢選択</span>
        <div className="question-card__text">{currentCard.front}</div>
      </div>

      <div className="mc-options">
        {currentCard.options?.map((option: CardOption, index: number) => {
          const isSelected = selectedAnswer === option.id;
          const isCorrect = option.isCorrect;
          let className = 'mc-option';

          if (showResult) {
            if (isCorrect) className += ' mc-option--correct';
            else if (isSelected && !isCorrect) className += ' mc-option--wrong';
          } else if (isSelected) {
            className += ' mc-option--selected';
          }

          return (
            <button
              key={option.id}
              className={className}
              onClick={() => !showResult && handleMultipleChoiceAnswer(option.id)}
              disabled={showResult}
            >
              <span className="mc-option__letter">{String.fromCharCode(65 + index)}</span>
              <span className="mc-option__text">{option.text}</span>
              {showResult && isCorrect && <span className="mc-option__check">✓</span>}
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className="answer-result">
          <div className={`answer-result__badge ${isAnswerCorrect() ? 'answer-result__badge--correct' : 'answer-result__badge--wrong'}`}>
            {isAnswerCorrect() ? '✓ 正解！' : '✗ 不正解'}
          </div>
          <div className="rating-buttons">
            <button className="rating-btn rating-btn--fail" onClick={() => handleRate(isAnswerCorrect() ? 5 : 1)}>
              <span>次へ</span>
              <span className="rating-btn__days">{getIntervalText(isAnswerCorrect() ? 5 : 1)}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <header className="header">
        <button className="header__back" onClick={onBack}>← {deck?.name || 'デッキ'}</button>
      </header>

      <div className="study-container">
        <div className="study-progress">
          <p className="study-progress__text">{currentIndex + 1} / {totalCards}</p>
          <div className="study-progress__bar">
            <div className="study-progress__fill" style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }} />
          </div>
        </div>

        {currentCard.type === 'flashcard' && renderFlashcard()}
        {currentCard.type === 'true_false' && renderTrueFalse()}
        {currentCard.type === 'multiple_choice' && renderMultipleChoice()}
      </div>
    </>
  );
}
