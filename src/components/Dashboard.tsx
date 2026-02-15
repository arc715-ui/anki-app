import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Cell,
} from 'recharts';
import { useStore } from '../stores/useStore';
import { useAuth } from '../stores/useAuth';
import {
  fetchDailyStudyStats,
  fetchSubjectAccuracy,
  fetchHeatmapData,
  type DailyStudyStat,
  type SubjectAccuracy,
  type HeatmapDay,
} from '../lib/analyticsService';

interface DashboardProps {
  onBack: () => void;
}

export function Dashboard({ onBack }: DashboardProps) {
  const { user } = useAuth();
  const { getExamStats, exams, weakPointRecommendations } = useStore();

  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStudyStat[]>([]);
  const [subjectAccuracy, setSubjectAccuracy] = useState<SubjectAccuracy[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const [daily, subjects, heatmap] = await Promise.all([
        fetchDailyStudyStats(user.id),
        fetchSubjectAccuracy(user.id),
        fetchHeatmapData(user.id),
      ]);
      setDailyStats(daily);
      setSubjectAccuracy(subjects);
      setHeatmapData(heatmap);
      setLoading(false);
    };

    load();
  }, [user]);

  const examStats = getExamStats();

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <button className="header__back" onClick={onBack}>← 戻る</button>
          <h1 className="header__title">ダッシュボード</h1>
        </header>
        <div className="dashboard">
          <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-secondary)' }}>
            データを読み込み中...
          </div>
        </div>
      </div>
    );
  }

  // --- Section A: Mastery Overview ---
  const masteryData = examStats.map((stat) => {
    const exam = exams.find((e) => e.id === stat.examId);
    return { ...stat, exam };
  });

  // --- Section C: Daily chart data ---
  const chartData = dailyStats.map((d) => ({
    date: d.date.slice(5), // MM-DD
    total: d.total,
    rate: d.total > 0 ? Math.round((d.correct / d.total) * 100) : null,
  }));

  // --- Section D: Subject accuracy sorted by rate asc (weakest first) ---
  const weakSubjects = new Set(weakPointRecommendations.map((r) => r.subject));
  const sortedSubjects = [...subjectAccuracy].sort((a, b) => a.rate - b.rate);

  return (
    <div className="app">
      <header className="header">
        <button className="header__back" onClick={onBack}>← 戻る</button>
        <h1 className="header__title">ダッシュボード</h1>
      </header>

      <div className="dashboard">
        {/* Section A: Mastery Overview */}
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">試験別マスタリー</h2>
          {masteryData.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              試験を登録してください
            </p>
          ) : (
            masteryData.map(({ exam, ...stat }) => {
              if (!exam) return null;
              const pct = stat.totalCards > 0
                ? Math.round((stat.masteredCards / stat.totalCards) * 100)
                : 0;
              return (
                <div key={stat.examId} className="mastery-row" style={{ '--exam-color': exam.color } as React.CSSProperties}>
                  <div className="mastery-row__header">
                    <span className="mastery-row__name">{exam.shortName}</span>
                    <span className="mastery-row__meta">
                      {stat.daysLeft}日 | Due {stat.dueCards}
                    </span>
                  </div>
                  <div className="mastery-bar">
                    <div
                      className="mastery-bar__fill"
                      style={{ width: `${pct}%`, background: exam.color }}
                    />
                  </div>
                  <div className="mastery-row__detail">
                    {stat.masteredCards}/{stat.totalCards} ({pct}%)
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Section B: Heatmap */}
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">学習カレンダー（12週）</h2>
          <Heatmap data={heatmapData} />
        </section>

        {/* Section C: Daily Stats Chart */}
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">日別学習量（30日）</h2>
          {chartData.every((d) => d.total === 0) ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              まだデータがありません
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  interval={6}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#252542',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any, name: any) => {
                    if (name === 'rate') return [`${value}%`, '正答率'];
                    return [value, '学習枚数'];
                  }) as any}
                />
                <Bar
                  yAxisId="left"
                  dataKey="total"
                  fill="#6366f1"
                  radius={[2, 2, 0, 0]}
                  opacity={0.8}
                />
                <Line
                  yAxisId="right"
                  dataKey="rate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Section D: Subject Accuracy */}
        <section className="dashboard__section">
          <h2 className="dashboard__section-title">科目別正答率</h2>
          {sortedSubjects.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              まだデータがありません
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, sortedSubjects.length * 32)}>
              <BarChart
                data={sortedSubjects}
                layout="vertical"
                margin={{ top: 0, right: 5, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  width={100}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#252542',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#f8fafc',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any) => [`${value}%`, '正答率']) as any}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {sortedSubjects.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={weakSubjects.has(entry.subject) ? '#ef4444' : '#6366f1'}
                      opacity={weakSubjects.has(entry.subject) ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {weakSubjects.size > 0 && (
            <div className="dashboard__legend">
              <span className="dashboard__legend-item dashboard__legend-item--weak">弱点科目</span>
              <span className="dashboard__legend-item dashboard__legend-item--normal">通常</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ============ Heatmap Component (Custom SVG) ============

function Heatmap({ data }: { data: HeatmapDay[] }) {
  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        まだデータがありません
      </p>
    );
  }

  const cellSize = 14;
  const gap = 3;
  const step = cellSize + gap;

  // Build 7 rows (Mon-Sun) x N weeks grid
  // Align to start on Monday
  const firstDate = new Date(data[0].date);
  const dayOfWeek = (firstDate.getDay() + 6) % 7; // 0=Mon

  // Pad front with empty cells to align to Monday
  const padded: (HeatmapDay | null)[] = Array(dayOfWeek).fill(null).concat(data);
  const totalWeeks = Math.ceil(padded.length / 7);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getColor = (count: number): string => {
    if (count === 0) return 'rgba(255,255,255,0.05)';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'rgba(99,102,241,0.25)';
    if (ratio < 0.5) return 'rgba(99,102,241,0.5)';
    if (ratio < 0.75) return 'rgba(99,102,241,0.75)';
    return 'rgba(99,102,241,1)';
  };

  const dayLabels = ['月', '', '水', '', '金', '', ''];
  const svgWidth = totalWeeks * step;
  const svgHeight = 7 * step;

  return (
    <div className="heatmap">
      <div className="heatmap__grid">
        <svg viewBox={`-20 0 ${svgWidth + 20} ${svgHeight}`} width="100%">
          {dayLabels.map((label, i) =>
            label ? (
              <text key={i} x={-4} y={i * step + cellSize - 2} fontSize={9} fill="#64748b" textAnchor="end">
                {label}
              </text>
            ) : null
          )}
          {padded.map((day, idx) => {
            if (!day) return null;
            const week = Math.floor(idx / 7);
            const dow = idx % 7;
            return (
              <rect
                key={day.date}
                x={week * step}
                y={dow * step}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count)}
              >
                <title>{day.date}: {day.count}枚</title>
              </rect>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
