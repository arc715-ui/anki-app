import { useState } from 'react';
import { useStore } from '../stores/useStore';

interface MilestoneManagerProps {
  onBack: () => void;
}

export function MilestoneManager({ onBack }: MilestoneManagerProps) {
  const { exams, milestones, addMilestone, updateMilestone, deleteMilestone, recordMockExamResult, getUpcomingMilestones } = useStore();
  const [selectedExam, setSelectedExam] = useState<string>(exams[0]?.name || '');

  const upcoming = getUpcomingMilestones(selectedExam || undefined);
  const completed = milestones
    .filter((m) => m.status !== 'upcoming' && (!selectedExam || m.examName === selectedExam))
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));

  const handleAdd = () => {
    const examName = selectedExam || exams[0]?.name;
    if (!examName) return;

    const title = prompt('タイトル（例: TAC模試 第1回）:');
    if (!title) return;
    const date = prompt('目標日（YYYY-MM-DD）:');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const scoreStr = prompt('目標点数（任意）:');
    const targetScore = scoreStr ? parseInt(scoreStr) : undefined;

    addMilestone({
      examName,
      title,
      targetDate: date,
      targetScore: targetScore && !isNaN(targetScore) ? targetScore : undefined,
    });
  };

  const handleRecordResult = (id: string) => {
    const scoreStr = prompt('実際の点数:');
    if (!scoreStr) return;
    const score = parseInt(scoreStr);
    if (isNaN(score)) return;
    recordMockExamResult(id, score);
  };

  const handleMarkMissed = (id: string) => {
    if (confirm('このマイルストーンをスキップしますか？')) {
      updateMilestone(id, { status: 'missed' });
    }
  };

  const getDaysLeft = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000);
    return diff;
  };

  return (
    <div className="app">
      <header className="header">
        <button className="header__back" onClick={onBack}>← ホーム</button>
        <h1 className="header__title">マイルストーン</h1>
        <div style={{ width: 60 }}></div>
      </header>

      {/* Exam Tabs */}
      {exams.length > 0 && (
        <div className="milestone-tabs">
          <button
            className={`milestone-tab ${!selectedExam ? 'milestone-tab--active' : ''}`}
            onClick={() => setSelectedExam('')}
          >
            すべて
          </button>
          {exams.map((exam) => (
            <button
              key={exam.id}
              className={`milestone-tab ${selectedExam === exam.name ? 'milestone-tab--active' : ''}`}
              style={selectedExam === exam.name ? { borderBottomColor: exam.color } : {}}
              onClick={() => setSelectedExam(exam.name)}
            >
              {exam.shortName}
            </button>
          ))}
        </div>
      )}

      <div className="milestone-list">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <h3 className="milestone-list__section-title">予定</h3>
            {upcoming.map((m) => {
              const daysLeft = getDaysLeft(m.targetDate);
              const exam = exams.find((e) => e.name === m.examName);
              return (
                <div key={m.id} className="milestone-card" style={{ borderLeftColor: exam?.color || 'var(--color-accent-primary)' }}>
                  <div className="milestone-card__header">
                    <div className="milestone-card__icon">🎯</div>
                    <div className="milestone-card__info">
                      <div className="milestone-card__title">{m.title}</div>
                      <div className="milestone-card__meta">
                        {m.examName} | {m.targetDate} | 残{daysLeft}日
                        {m.targetScore != null && ` | 目標: ${m.targetScore}点`}
                      </div>
                    </div>
                  </div>
                  <div className="milestone-card__actions">
                    <button className="btn btn--primary" onClick={() => handleRecordResult(m.id)} style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
                      結果入力
                    </button>
                    <button className="btn btn--secondary" onClick={() => handleMarkMissed(m.id)} style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
                      スキップ
                    </button>
                    <button className="btn btn--danger" onClick={() => { if (confirm('削除しますか？')) deleteMilestone(m.id); }} style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)' }}>
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Completed / Missed */}
        {completed.length > 0 && (
          <>
            <h3 className="milestone-list__section-title">完了・スキップ</h3>
            {completed.map((m) => {
              const exam = exams.find((e) => e.name === m.examName);
              const gap = m.targetScore != null && m.actualScore != null
                ? m.actualScore - m.targetScore
                : null;
              return (
                <div key={m.id} className={`milestone-card milestone-card--${m.status}`} style={{ borderLeftColor: exam?.color || 'var(--color-accent-primary)' }}>
                  <div className="milestone-card__header">
                    <div className="milestone-card__icon">{m.status === 'completed' ? '✅' : '❌'}</div>
                    <div className="milestone-card__info">
                      <div className="milestone-card__title">{m.title}</div>
                      <div className="milestone-card__meta">
                        {m.examName} | {m.targetDate}
                        {m.targetScore != null && ` | 目標: ${m.targetScore}点`}
                        {m.actualScore != null && ` | 結果: ${m.actualScore}点`}
                      </div>
                      {gap != null && (
                        <div className={`milestone-card__gap ${gap >= 0 ? 'milestone-card__gap--positive' : 'milestone-card__gap--negative'}`}>
                          {gap >= 0 ? `+${gap}点 目標達成!` : `${gap}点 目標未達`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {upcoming.length === 0 && completed.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🎯</div>
            <h3 className="empty-state__title">マイルストーンがありません</h3>
            <p className="empty-state__text">模試や中間目標を追加しましょう</p>
          </div>
        )}

        <button className="btn btn--primary btn--full" onClick={handleAdd} style={{ marginTop: 'var(--spacing-lg)' }}>
          + マイルストーンを追加
        </button>
      </div>
    </div>
  );
}
