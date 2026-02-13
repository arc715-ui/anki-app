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
  const { getDueCardsForDeck, getSubjectsForDeck, reviewCardAction, recordSession, decks } = useStore();

  const deck = decks.find((d) => d.id === deckId);
  const subjects = getSubjectsForDeck(deckId);

  // Subject filter state
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(subjects.length === 0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionCards, setSessionCards] = useState<Card[]>([]);

  // For multiple choice / true-false
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(null);
  const [showResult, setShowResult] = useState(false);

  const currentCard = sessionCards[currentIndex];
  const totalCards = sessionCards.length;

  const handleStartSession = (subject: string | null) => {
    setSelectedSubject(subject);
    const cards = getDueCardsForDeck(deckId, subject || undefined);
    setSessionCards([...cards]);
    setSessionStarted(true);
    setCurrentIndex(0);
    setStudiedCount(0);
    setCorrectCount(0);
  };

  // Auto-start if no subjects
  if (!sessionStarted && subjects.length === 0) {
    const cards = getDueCardsForDeck(deckId);
    if (cards.length > 0 && sessionCards.length === 0) {
      setSessionCards([...cards]);
    }
  }

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

  // Subject selection screen
  if (!sessionStarted && subjects.length > 0) {
    const allDueCount = getDueCardsForDeck(deckId).length;
    return (
      <div className="app">
        <header className="header">
          <button className="header__back" onClick={onBack}>← {deck?.name || 'デッキ'}</button>
        </header>
        <div className="subject-filter">
          <h2 className="subject-filter__title">科目を選択</h2>
          <div className="subject-filter__chips">
            <button
              className="subject-chip subject-chip--all"
              onClick={() => handleStartSession(null)}
            >
              すべて ({allDueCount}枚)
            </button>
            {subjects.map((subj) => {
              const count = getDueCardsForDeck(deckId, subj).length;
              return (
                <button
                  key={subj}
                  className="subject-chip"
                  onClick={() => handleStartSession(subj)}
                  disabled={count === 0}
                >
                  {subj} ({count}枚)
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // No cards to study
  if (sessionCards.length === 0 || totalCards === 0) {
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

  const renderExplanation = (card: Card) => (
    <div className="explanation-card">
      {card.correctRate != null && (
        <div className="explanation-card__badge">
          {card.difficulty || `正解率: ${card.correctRate}%`}
        </div>
      )}

      {card.point && (
        <div className="explanation-card__section">
          <div className="explanation-card__title">ポイント</div>
          <div className="explanation-card__point">{card.point}</div>
        </div>
      )}

      {card.back && (
        <div className="explanation-card__section">
          <div className="explanation-card__title">解説</div>
          <div className="explanation-card__content">{card.back}</div>
        </div>
      )}

      {card.source && (
        <div className="explanation-card__section">
          <div className="explanation-card__title">出典</div>
          <div className="explanation-card__source">{card.source}</div>
        </div>
      )}
    </div>
  );

  const renderRatingButtons = (correct: boolean) => (
    <div className="rating-buttons">
      {correct ? (
        <>
          <button className="rating-btn rating-btn--fail" onClick={() => handleRate(3)}>
            <span>{getQualityLabel(3)}</span>
            <span className="rating-btn__days">{getIntervalText(3)}</span>
          </button>
          <button className="rating-btn rating-btn--hard" onClick={() => handleRate(4)}>
            <span>{getQualityLabel(4)}</span>
            <span className="rating-btn__days">{getIntervalText(4)}</span>
          </button>
          <button className="rating-btn rating-btn--good" onClick={() => handleRate(5)}>
            <span>{getQualityLabel(5)}</span>
            <span className="rating-btn__days">{getIntervalText(5)}</span>
          </button>
        </>
      ) : (
        <>
          <button className="rating-btn rating-btn--fail" onClick={() => handleRate(1)}>
            <span>もう一度</span>
            <span className="rating-btn__days">{getIntervalText(1)}</span>
          </button>
          <button className="rating-btn rating-btn--hard" onClick={() => handleRate(3)}>
            <span>難しかった</span>
            <span className="rating-btn__days">{getIntervalText(3)}</span>
          </button>
        </>
      )}
    </div>
  );

  const renderTrueFalse = () => (
    <>
      <div className="question-card">
        <span className="question-card__type">正誤問題</span>
        <div className="question-card__text">{currentCard.front}</div>
      </div>

      {!showResult ? (
        <div className="tf-answer-buttons">
          <button className="tf-answer-btn tf-answer-btn--true" onClick={() => handleTrueFalseAnswer(true)}>
            <span className="tf-answer-btn__icon">◯</span>
            <span>正しい</span>
          </button>
          <button className="tf-answer-btn tf-answer-btn--false" onClick={() => handleTrueFalseAnswer(false)}>
            <span className="tf-answer-btn__icon">✕</span>
            <span>間違い</span>
          </button>
        </div>
      ) : (
        <div className="answer-result">
          <div className={`answer-result__badge ${isAnswerCorrect() ? 'answer-result__badge--correct' : 'answer-result__badge--wrong'}`}>
            {isAnswerCorrect() ? '正解！' : '不正解'}
          </div>
          <p className="answer-result__text">正解: {currentCard.correctAnswer ? '正しい' : '間違い'}</p>
          {renderExplanation(currentCard)}
          {renderRatingButtons(isAnswerCorrect())}
        </div>
      )}
    </>
  );

  const renderMultipleChoice = () => (
    <>
      <div className="question-card">
        <span className="question-card__type">多肢選択</span>
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
            {isAnswerCorrect() ? '正解！' : '不正解'}
          </div>
          {renderExplanation(currentCard)}
          {renderRatingButtons(isAnswerCorrect())}
        </div>
      )}
    </>
  );

  return (
    <>
      <header className="header">
        <button className="header__back" onClick={onBack}>← {deck?.name || 'デッキ'}</button>
        {selectedSubject && (
          <span className="header__subject-badge">{selectedSubject}</span>
        )}
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
