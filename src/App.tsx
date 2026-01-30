import { useState, useEffect } from 'react';
import { useStore } from './stores/useStore';
import { useAuth } from './stores/useAuth';
import { DeckList } from './components/DeckList';
import { StudySession } from './components/StudySession';
import { CardEditor } from './components/CardEditor';
import { ImportExam } from './components/ImportExam';
import { AuthButton } from './components/AuthButton';
import { fetchAllFromRemote, syncToRemote } from './lib/syncService';
import type { Deck } from './types';
import './index.css';

type View = 'home' | 'study' | 'edit' | 'import';

function App() {
  const { user, initialize } = useAuth();
  const store = useStore();
  const { streak, getTodayStats, cards, getDueCardsForDeck, decks, sessions, lastStudyDate } = store;

  const [view, setView] = useState<View>('home');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync with Supabase when user logs in
  useEffect(() => {
    if (!user) return;

    const doSync = async () => {
      setSyncing(true);
      setSyncStatus('同期中...');

      try {
        // Fetch remote data
        const remoteData = await fetchAllFromRemote(user.id);

        // If remote has data, merge it
        if (remoteData.decks.length > 0 || remoteData.cards.length > 0) {
          // Merge remote data with local (remote takes priority for now)
          useStore.setState({
            decks: mergeById(decks, remoteData.decks),
            cards: mergeById(cards, remoteData.cards),
            sessions: mergeById(sessions, remoteData.sessions),
            streak: remoteData.streak || streak,
            lastStudyDate: remoteData.lastStudyDate || lastStudyDate,
          });
        }

        // Push local data to remote
        const currentState = useStore.getState();
        await syncToRemote(
          user.id,
          currentState.decks,
          currentState.cards,
          currentState.sessions,
          currentState.streak,
          currentState.lastStudyDate
        );

        setSyncStatus('同期完了 ✓');
        setTimeout(() => setSyncStatus(null), 2000);
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('同期エラー');
        setTimeout(() => setSyncStatus(null), 3000);
      } finally {
        setSyncing(false);
      }
    };

    doSync();
  }, [user?.id]);

  // Helper to merge arrays by id, preferring items with later updatedAt
  function mergeById<T extends { id: string; updatedAt?: string }>(local: T[], remote: T[]): T[] {
    const map = new Map<string, T>();

    for (const item of local) {
      map.set(item.id, item);
    }

    for (const item of remote) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else if (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt) {
        map.set(item.id, item);
      } else if (!existing.updatedAt && item.updatedAt) {
        map.set(item.id, item);
      }
    }

    return Array.from(map.values());
  }

  // Sync changes to remote whenever data changes (debounced)
  useEffect(() => {
    if (!user) return;

    const timeoutId = setTimeout(async () => {
      try {
        await syncToRemote(user.id, decks, cards, sessions, streak, lastStudyDate);
      } catch (error) {
        console.error('Background sync error:', error);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [user?.id, decks, cards, sessions, streak, lastStudyDate]);

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

  const handleImport = (deck: Deck) => {
    setSelectedDeck(deck);
    setView('import');
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
        <CardEditor deckId={selectedDeck.id} onBack={handleBack} onGoToImport={() => setView('import')} />
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
        {syncStatus && (
          <div className={`sync-status ${syncing ? 'syncing' : ''}`}>
            {syncStatus}
          </div>
        )}
      </header>

      <AuthButton />

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

      <DeckList onSelectDeck={handleSelectDeck} onImport={handleImport} />

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
