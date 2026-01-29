import { useState } from 'react';
import { useStore } from './stores/useStore';
import { DeckList } from './components/DeckList';
import { StudySession } from './components/StudySession';
import { CardEditor } from './components/CardEditor';
import { ImportExam } from './components/ImportExam';
import type { Deck } from './types';
import './index.css';

type View = 'home' | 'study' | 'edit' | 'import';

function App() {
  const { streak, getTodayStats, cards, getDueCardsForDeck } = useStore();
  const [view, setView] = useState<View>('home');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  const todayStats = getTodayStats();
  const totalDueCards = cards.filter(c => new Date(c.nextReview) <= new Date()).length;

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);
    const dueCards = getDueCardsForDeck(deck.id);
    if (dueCards.length > 0) {
      setView('study');
    } else {
      setView('edit');
    }
  };

  const handleBack = () => {
    setView('home');
    setSelectedDeck(null);
  };

  if (view === 'study' && selectedDeck) {
    return (
      <div className="app">
        <StudySession
          deckId={selectedDeck.id}
          onComplete={() => setView('home')}
          onBack={handleBack}
        />
      </div>
    );
  }

  if (view === 'edit' && selectedDeck) {
    return (
      <div className="app">
        <CardEditor deckId={selectedDeck.id} onBack={handleBack} />
      </div>
    );
  }

  if (view === 'import' && selectedDeck) {
    return (
      <div className="app">
        <ImportExam deckId={selectedDeck.id} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__title">📚 暗記カード</h1>
      </header>

      <div className="stats-banner">
        <div className="stat-card stat-card--streak">
          <div className="stat-card__value">🔥 {streak}</div>
          <div className="stat-card__label">連続日数</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{todayStats.cardsStudied}</div>
          <div className="stat-card__label">今日学習</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{totalDueCards}</div>
          <div className="stat-card__label">復習待ち</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{Math.round(todayStats.correctRate)}%</div>
          <div className="stat-card__label">正解率</div>
        </div>
      </div>

      <DeckList onSelectDeck={handleSelectDeck} />

      <nav className="nav-bar">
        <button className="nav-bar__item nav-bar__item--active">
          <span className="nav-bar__icon">🏠</span>
          <span>ホーム</span>
        </button>
        <button className="nav-bar__item" onClick={() => selectedDeck && setView('edit')}>
          <span className="nav-bar__icon">📝</span>
          <span>編集</span>
        </button>
        <button className="nav-bar__item" onClick={() => selectedDeck && setView('import')}>
          <span className="nav-bar__icon">📥</span>
          <span>インポート</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
