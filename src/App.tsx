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
  const {
    streak, getTodayStats, cards, getDueCardsForDeck, decks, sessions, lastStudyDate,
    exams, addExam, updateExam, removeExam, getExamStats, getTotalDailyQuota,
  } = store;

  const [view, setView] = useState<View>('home');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showExamSettings, setShowExamSettings] = useState(false);

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
        const remoteData = await fetchAllFromRemote(user.id);

        if (remoteData.decks.length > 0 || remoteData.cards.length > 0) {
          useStore.setState({
            decks: mergeById(decks, remoteData.decks),
            cards: mergeById(cards, remoteData.cards),
            sessions: mergeById(sessions, remoteData.sessions),
            streak: remoteData.streak || streak,
            lastStudyDate: remoteData.lastStudyDate || lastStudyDate,
            exams: remoteData.exams.length > 0 ? remoteData.exams : exams,
          });
        }

        const currentState = useStore.getState();
        await syncToRemote(
          user.id,
          currentState.decks,
          currentState.cards,
          currentState.sessions,
          currentState.streak,
          currentState.lastStudyDate,
          currentState.exams
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

  function mergeById<T extends { id: string; updatedAt?: string }>(local: T[], remote: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of local) map.set(item.id, item);
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

  // Background sync
  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(async () => {
      try {
        await syncToRemote(user.id, decks, cards, sessions, streak, lastStudyDate, exams);
      } catch (error) {
        console.error('Background sync error:', error);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [user?.id, decks, cards, sessions, streak, lastStudyDate, exams]);

  const todayStats = getTodayStats();
  const totalDueCards = cards.filter(c => new Date(c.nextReview) <= new Date()).length;
  const examStats = getExamStats();
  const totalDailyQuota = getTotalDailyQuota();

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

  const handleAddExam = () => {
    const name = prompt('試験名（例: 社労士）:');
    if (!name) return;
    const date = prompt('試験日（YYYY-MM-DD）:');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const pattern = prompt('デッキ名のキーワード（例: 社労士）:', name);
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    addExam({
      name,
      shortName: name.length > 4 ? name.slice(0, 4) : name,
      examDate: date,
      deckPattern: pattern || name,
      weight: 1.0,
      prioritySubjects: [],
      color: colors[exams.length % colors.length],
    });
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
        <h1 className="header__title">暗記カード</h1>
        {syncStatus && (
          <div className={`sync-status ${syncing ? 'syncing' : ''}`}>
            {syncStatus}
          </div>
        )}
      </header>

      <AuthButton />

      <div className="stats-banner">
        <div className="stat-card stat-card--streak">
          <div className="stat-card__value">{streak}</div>
          <div className="stat-card__label">連続日数</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">
            {todayStats.cardsStudied}/{totalDailyQuota || '—'}
          </div>
          <div className="stat-card__label">ノルマ</div>
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

      {/* Multi-exam countdowns */}
      {exams.length > 0 ? (
        <div className="exam-countdowns" onClick={() => setShowExamSettings(true)}>
          {examStats.map((stat) => {
            const exam = exams.find((e) => e.id === stat.examId)!;
            return (
              <div key={stat.examId} className="exam-countdown" style={{ borderLeftColor: exam.color }}>
                <div className="exam-countdown__name">{exam.shortName}</div>
                <div className="exam-countdown__days">{stat.daysLeft}日</div>
                <div className="exam-countdown__quota">{stat.dailyQuota}枚/日</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="exam-date-setup" onClick={() => setShowExamSettings(true)}>
          <span className="exam-date-setup__text">試験を登録してスケジュール開始</span>
        </div>
      )}

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

      {/* Exam Settings Modal */}
      {showExamSettings && (
        <div className="modal-overlay" onClick={() => setShowExamSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">試験設定</h3>
              <button className="modal__close" onClick={() => setShowExamSettings(false)}>×</button>
            </div>
            <div className="modal__body">
              {exams.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>
                  試験を追加して自動ノルマ計算を開始
                </p>
              )}
              {exams.map((exam) => {
                const stat = examStats.find((s) => s.examId === exam.id);
                return (
                  <div key={exam.id} className="exam-setting-card" style={{ borderLeftColor: exam.color }}>
                    <div className="exam-setting-card__header">
                      <strong>{exam.name}</strong>
                      <span className="exam-setting-card__days">{stat?.daysLeft}日</span>
                    </div>
                    <div className="exam-setting-card__meta">
                      試験日: {exam.examDate} | ノルマ: {stat?.dailyQuota}枚/日
                    </div>
                    <div className="exam-setting-card__meta">
                      カード: {stat?.totalCards} | 習得: {stat?.masteredCards} | 復習待ち: {stat?.dueCards}
                    </div>
                    <div className="exam-setting-card__meta">
                      パターン: 「{exam.deckPattern}」
                    </div>
                    <div className="exam-setting-card__actions">
                      <button className="btn btn--secondary" onClick={() => {
                        const date = prompt('試験日 (YYYY-MM-DD):', exam.examDate);
                        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                          updateExam(exam.id, { examDate: date });
                        }
                      }}>日付</button>
                      <button className="btn btn--secondary" onClick={() => {
                        const w = prompt('重み (0.5=低, 1.0=通常, 2.0=高):', String(exam.weight));
                        if (w) {
                          const n = parseFloat(w);
                          if (!isNaN(n) && n > 0) updateExam(exam.id, { weight: n });
                        }
                      }}>重み: {exam.weight}</button>
                      <button className="btn btn--secondary" onClick={() => {
                        const p = prompt('デッキ名キーワード:', exam.deckPattern);
                        if (p !== null) updateExam(exam.id, { deckPattern: p });
                      }}>パターン</button>
                      <button className="btn btn--danger" onClick={() => {
                        if (confirm(`${exam.name}を削除しますか？`)) removeExam(exam.id);
                      }}>削除</button>
                    </div>
                  </div>
                );
              })}
              <button className="btn btn--primary btn--full" onClick={handleAddExam} style={{ marginTop: 'var(--spacing-md)' }}>
                + 試験を追加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
