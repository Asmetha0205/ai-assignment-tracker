import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import { getProgress } from '../api/services';
import { Target, Award, Calendar, CheckCircle, ArrowLeft, Timer, Brain, Clock, Flame } from 'lucide-react';
import { getPomodoroStats, POMODORO_STATS_EVENT, getLocalDateKey, countSessionsForDate } from '../utils/pomodoroStorage';

// ── Streak Heatmap ────────────────────────────────────────────────────────────
const StreakHeatmap = ({ sessions, activeDays }) => {
  const currentYear = new Date().getFullYear();

  // Find Sunday of the week containing Jan 1st of current year
  const startDate = new Date(currentYear, 0, 1);
  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);

  // Find Saturday of the week containing Dec 31st of current year
  const endDate = new Date(currentYear, 11, 31);
  const endDay = endDate.getDay();
  endDate.setDate(endDate.getDate() + (6 - endDay));

  // Generate all days for this calendar year grid
  const days = [];
  const curr = new Date(startDate);
  while (curr <= endDate) {
    days.push(getLocalDateKey(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const countMap = {};
  days.forEach(dk => {
    const pomodoros = countSessionsForDate(sessions, dk);
    const otherActivities = activeDays?.[dk] || 0;
    countMap[dk] = pomodoros + otherActivities;
  });

  const maxCount = Math.max(1, ...Object.values(countMap));

  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100';
    const intensity = count / maxCount;
    if (intensity <= 0.25) return 'bg-indigo-200';
    if (intensity <= 0.5)  return 'bg-indigo-400';
    if (intensity <= 0.75) return 'bg-indigo-600';
    return 'bg-indigo-800';
  };

  // Group into weeks (columns of 7)
  const weeks = [];
  const totalWeeks = Math.ceil(days.length / 7);
  for (let w = 0; w < totalWeeks; w++) {
    weeks.push(days.slice(w * 7, w * 7 + 7));
  }

  // Group weeks by month of the current year (0 = Jan, 11 = Dec)
  const monthGroups = [];
  for (let m = 0; m < 12; m++) {
    const monthWeeks = [];
    weeks.forEach((week) => {
      const hasDayInMonth = week.some((dk) => {
        const [y, mm] = dk.split('-').map(Number);
        return y === currentYear && (mm - 1) === m;
      });
      if (hasDayInMonth) {
        monthWeeks.push(week);
      }
    });

    if (monthWeeks.length > 0) {
      const monthLabel = new Date(currentYear, m, 1).toLocaleDateString('en-US', { month: 'short' });
      monthGroups.push({
        monthIndex: m,
        monthLabel,
        weeks: monthWeeks
      });
    }
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate current streak starting from today going backwards
  let streak = 0;
  const todayKey = getLocalDateKey();
  const todayIndex = days.indexOf(todayKey);
  if (todayIndex !== -1) {
    for (let i = todayIndex; i >= 0; i--) {
      const dk = days[i];
      if (countMap[dk] > 0) {
        streak++;
      } else {
        if (i < todayIndex) break;
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <Flame className="w-5 h-5 mr-2 text-orange-500" />
          Study Streak — {currentYear}
        </h2>
        <div className="flex items-center space-x-1 bg-orange-50 px-3 py-1 rounded-full">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-600">{streak} day streak</span>
        </div>
      </div>

      <div className="flex flex-col">
        {/* Month labels */}
        <div className="flex mb-2">
          {/* Spacer to align with Day-of-week labels */}
          <div style={{ width: 24 }} className="mr-2" />
          <div className="flex space-x-4">
            {monthGroups.map((group, gi) => {
              const weeksCount = group.weeks.length;
              const width = weeksCount * 14 + (weeksCount - 1) * 4;
              return (
                <div
                  key={gi}
                  className="text-xs text-indigo-600 font-bold select-none"
                  style={{ width }}
                >
                  {group.monthLabel}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex items-start">
          {/* Day-of-week labels */}
          <div className="flex flex-col justify-between mr-2" style={{ paddingTop: 2, width: 24, height: 122 }}>
            {dayLabels.map((d, i) => (
              <div key={i} className="text-xs text-gray-400 leading-none select-none" style={{ height: 14, lineHeight: '14px' }}>
                {i % 2 === 1 ? d.slice(0, 1) : ''}
              </div>
            ))}
          </div>

          {/* Month groups with space-x-4 spacing */}
          <div className="flex space-x-4">
            {monthGroups.map((group, gi) => (
              <div key={gi} className="flex space-x-1">
                {group.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col space-y-1">
                    {week.map((dk) => {
                      const [y, mm] = dk.split('-').map(Number);
                      const isSameMonth = y === currentYear && (mm - 1) === group.monthIndex;

                      if (!isSameMonth) {
                        return (
                          <div
                            key={dk}
                            className="rounded-sm"
                            style={{ height: 14, width: 14, opacity: 0, pointerEvents: 'none' }}
                          />
                        );
                      }

                      const count = countMap[dk] || 0;
                      const isToday = dk === getLocalDateKey();
                      return (
                        <div
                          key={dk}
                          title={`${dk}: ${count} contribution${count !== 1 ? 's' : ''}`}
                          className={`rounded-sm cursor-default transition-all duration-100 hover:scale-125 hover:shadow-sm origin-center ${getColor(count)}
                            ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                          style={{ height: 14, width: 14 }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end space-x-1 mt-2">
        <span className="text-xs text-gray-400 mr-1">Less</span>
        {['bg-gray-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600', 'bg-indigo-800'].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-xs text-gray-400 ml-1">More</span>
      </div>
    </div>
  );
};

// ── Progress Circle ───────────────────────────────────────────────────────────
const ProgressCircle = ({ percentage, size = 120, strokeWidth = 8, color = '#6366f1', label, value }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
          {value && <span className="text-xs text-gray-500">{value}</span>}
        </div>
      </div>
      {label && <p className="mt-2 text-sm font-medium text-gray-700">{label}</p>}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Progress = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pomodoroRefresh, setPomodoroRefresh] = useState(0);

  const fetchProgress = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return; }
    try {
      const response = await getProgress(user.uid);
      if (response.success) setProgressData(response);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  useEffect(() => { setPomodoroRefresh(n => n + 1); }, [location.pathname]);

  useEffect(() => {
    const refresh = () => setPomodoroRefresh(n => n + 1);
    const onStatsUpdate = (e) => { if (!user?.uid || e.detail?.userId === user.uid) refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(POMODORO_STATS_EVENT, onStatsUpdate);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(POMODORO_STATS_EVENT, onStatsUpdate);
    };
  }, [user?.uid]);

  const pomodoroStats = useMemo(
    () => getPomodoroStats(user?.uid),
    [user?.uid, pomodoroRefresh]
  );

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <div className="text-white text-xl">Loading progress...</div>
      </div>
    );
  }

  const dailyGoal = 8;
  const pomodoroProgress = {
    todaySessions: pomodoroStats.todaySessions,
    totalSessions: pomodoroStats.totalSessions,
    focusMinutes: pomodoroStats.totalFocusMinutes,
    completionRate: pomodoroStats.todaySessions > 0
      ? Math.min(100, Math.round((pomodoroStats.todaySessions / dailyGoal) * 100))
      : 0,
  };

  const quizStats = progressData?.quiz_stats || {
    total_quizzes: 0, total_questions: 0, total_correct: 0, average_score: 0
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Back Button */}
        <button onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center space-x-2 text-white hover:text-indigo-200 transition-all">
          <ArrowLeft className="w-5 h-5" /><span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-2">📊 Progress Tracker</h1>
          <p className="text-white/80 text-lg">Track your learning journey and achievements</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-slide-up">
          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Daily Focus Goal</p>
                <p className="text-3xl font-bold text-indigo-600">{pomodoroProgress.completionRate}%</p>
                <p className="text-xs text-gray-400 mt-1">{pomodoroProgress.todaySessions} of {dailyGoal} pomodoros today</p>
              </div>
              <Target className="w-12 h-12 text-indigo-600" />
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Pomodoros</p>
                <p className="text-3xl font-bold text-green-600">{pomodoroProgress.totalSessions}</p>
                <p className="text-xs text-gray-400 mt-1">{pomodoroProgress.focusMinutes} min focus time</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-orange-600">{progressData?.user?.streak || 0}</p>
                <p className="text-xs text-gray-400 mt-1">days in a row</p>
              </div>
              <Calendar className="w-12 h-12 text-orange-600" />
            </div>
          </Card>

          <Card hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Points</p>
                <p className="text-3xl font-bold text-purple-600">{progressData?.user?.total_points || 0}</p>
                <p className="text-xs text-gray-400 mt-1">earned so far</p>
              </div>
              <Award className="w-12 h-12 text-purple-600" />
            </div>
          </Card>
        </div>

        {/* ── STREAK HEATMAP ─────────────────────────────────────────────── */}
        <Card className="mb-8 animate-slide-up overflow-x-auto">
          <StreakHeatmap 
            sessions={pomodoroStats.sessions || []} 
            activeDays={progressData?.user?.active_days || {}} 
          />
        </Card>

        {/* Progress Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pomodoro Progress */}
          <Card>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <Timer className="w-5 h-5 mr-2 text-indigo-600" />
              Pomodoro Progress
            </h2>
            <div className="flex flex-col items-center space-y-6">
              <ProgressCircle
                percentage={pomodoroProgress.completionRate}
                color="#6366f1"
                label="Daily Goal"
                value={`${pomodoroProgress.todaySessions}/${dailyGoal} today`}
              />
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-indigo-600">{pomodoroProgress.todaySessions}</p>
                  <p className="text-sm text-gray-600">Today</p>
                  <p className="text-xs text-gray-400 mt-1">pomodoros completed</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{pomodoroProgress.focusMinutes}</p>
                  <p className="text-sm text-gray-600">Focus Minutes</p>
                  <p className="text-xs text-gray-400 mt-1">all time</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quiz Performance */}
          <Card>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <Brain className="w-5 h-5 mr-2 text-purple-600" />
              Quiz Performance
            </h2>
            {quizStats.total_quizzes > 0 ? (
              <div className="flex flex-col items-center space-y-6">
                <ProgressCircle
                  percentage={quizStats.average_score}
                  color="#8b5cf6"
                  label="Average Score"
                  value={`${quizStats.total_correct}/${quizStats.total_questions} correct`}
                />
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600">{quizStats.total_quizzes}</p>
                    <p className="text-sm text-gray-600">Quizzes Taken</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{quizStats.total_questions}</p>
                    <p className="text-sm text-gray-600">Questions Answered</p>
                  </div>
                </div>
                {progressData?.quiz_results?.length > 0 && (
                  <div className="w-full mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Recent Quiz Results</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {progressData.quiz_results.slice(0, 5).map((quiz, index) => {
                        const pct = quiz.total_questions > 0
                          ? Math.round((quiz.score / quiz.total_questions) * 100) : 0;
                        return (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-700">Quiz {progressData.quiz_results.length - index}</span>
                            <span className={`text-sm font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {quiz.score}/{quiz.total_questions} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Brain className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-center">No quizzes taken yet</p>
                <p className="text-sm text-center mt-2">Take quizzes to track your performance!</p>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Focus Sessions */}
        <Card>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Timer className="w-5 h-5 mr-2 text-indigo-600" />
            Recent Focus Sessions
          </h2>
          {pomodoroStats.sessions?.length > 0 ? (
            <div className="space-y-3">
              {pomodoroStats.sessions.slice(0, 10).map((session, index) => (
                <div key={index}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-all">
                  <div className="flex items-center min-w-0">
                    <Clock className="w-4 h-4 mr-2 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{session.task || 'Focus session'}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <span className="text-sm font-semibold text-indigo-600">{session.focusMinutes} min</span>
                    <p className="text-xs text-gray-400">{new Date(session.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Timer className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p>No pomodoro sessions yet. Start a timer to track your focus!</p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};

export default Progress;
