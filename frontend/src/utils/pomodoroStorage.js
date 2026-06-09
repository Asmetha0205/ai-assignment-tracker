const STORAGE_KEY = 'pomodoro_stats';
export const POMODORO_STATS_EVENT = 'pomodoro-stats-updated';

/** Local calendar date YYYY-MM-DD */
export const getLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getSessionDateKey = (session) => {
  if (!session) return null;
  if (session.dateKey) return session.dateKey;
  if (session.date) return getLocalDateKey(new Date(session.date));
  return null;
};

const sessionOnDate = (session, dateKey) => getSessionDateKey(session) === dateKey;

export const countSessionsForDate = (sessions, dateKey = getLocalDateKey()) =>
  (sessions || []).filter((s) => sessionOnDate(s, dateKey)).length;

const defaultStats = () => ({
  totalSessions: 0,
  totalFocusMinutes: 0,
  todaySessions: 0,
  lastSessionDate: null,
  sessions: [],
});

const recomputeFromSessions = (stats) => {
  const sessions = stats.sessions || [];
  const today = getLocalDateKey();
  return {
    ...stats,
    sessions,
    totalSessions: sessions.length,
    totalFocusMinutes: sessions.reduce((sum, s) => sum + (s.focusMinutes || 0), 0),
    todaySessions: countSessionsForDate(sessions, today),
    lastSessionDate: sessions.length > 0 ? getSessionDateKey(sessions[0]) : stats.lastSessionDate,
  };
};

const normalizeStats = (raw) => recomputeFromSessions({ ...defaultStats(), ...raw });

export const getPomodoroStats = (userId) => {
  if (!userId) return defaultStats();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return defaultStats();
    return normalizeStats(JSON.parse(raw));
  } catch {
    return defaultStats();
  }
};

export const savePomodoroStats = (userId, stats) => {
  if (!userId) return;
  const normalized = normalizeStats(stats);
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(POMODORO_STATS_EVENT, { detail: { userId } }));
  return normalized;
};

export const recordPomodoroSession = (userId, { focusMinutes, task = '' }) => {
  if (!userId) return defaultStats();

  const stats = getPomodoroStats(userId);
  const today = getLocalDateKey();
  const now = new Date();

  const sessions = [
    {
      date: now.toISOString(),
      dateKey: today,
      focusMinutes,
      task,
    },
    ...(stats.sessions || []).slice(0, 49),
  ];

  return savePomodoroStats(userId, {
    ...stats,
    sessions,
    lastSessionDate: today,
  });
};

export const clearPomodoroStats = (userId) => {
  if (!userId) return;
  localStorage.removeItem(`${STORAGE_KEY}_${userId}`);
  window.dispatchEvent(new CustomEvent(POMODORO_STATS_EVENT, { detail: { userId } }));
};
