import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  Coffee,
  Settings,
  Target,
  Flame,
  Clock,
} from 'lucide-react';
import {
  getPomodoroStats,
  clearPomodoroStats,
  POMODORO_STATS_EVENT,
} from '../utils/pomodoroStorage';
import {
  getTimerState,
  saveTimerState,
  startGlobalTimer,
  stopGlobalTimer,
  subscribeToTimer,
} from '../utils/pomodoroTimer';
import { unlockAudio, isSoundEnabled, setSoundEnabled } from '../utils/notifications';
import NotificationBanner from '../components/NotificationBanner';

const MODES = {
  work: { label: 'Focus', icon: Target, color: 'from-red-500 to-rose-600', ring: '#ef4444' },
  shortBreak: { label: 'Short Break', icon: Coffee, color: 'from-green-500 to-emerald-600', ring: '#22c55e' },
  longBreak: { label: 'Long Break', icon: Coffee, color: 'from-blue-500 to-cyan-600', ring: '#3b82f6' },
};

const DEFAULT_SETTINGS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

const Pomodoro = ({ user }) => {
  const navigate = useNavigate();

  const savedState = user?.uid ? getTimerState(user.uid) : null;

  const [mode, setMode] = useState(savedState?.mode || 'work');
  const [settings, setSettings] = useState(savedState?.settings || DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [task, setTask] = useState(savedState?.task || '');
  const [secondsLeft, setSecondsLeft] = useState(
    savedState?.secondsLeft ?? DEFAULT_SETTINGS.workMinutes * 60
  );
  const [isRunning, setIsRunning] = useState(savedState?.isRunning || false);
  const [completedPomodoros, setCompletedPomodoros] = useState(savedState?.completedPomodoros || 0);
  const [stats, setStats] = useState(() => getPomodoroStats(user?.uid));
  const skipModeChangeRef = useRef(false);
  const prevModeSettingsKey = useRef(null);

  const getDurationSeconds = useCallback(
    (targetMode) => {
      if (targetMode === 'work') return settings.workMinutes * 60;
      if (targetMode === 'shortBreak') return settings.shortBreakMinutes * 60;
      return settings.longBreakMinutes * 60;
    },
    [settings]
  );

  // Load persisted state on mount / user change
  useEffect(() => {
    if (!user?.uid) return;
    const state = getTimerState(user.uid);

    const nextSettings = state?.settings ?? DEFAULT_SETTINGS;
    const nextMode = state?.mode ?? 'work';
    prevModeSettingsKey.current = `${nextMode}-${nextSettings.workMinutes}-${nextSettings.shortBreakMinutes}-${nextSettings.longBreakMinutes}`;

    if (!state) return;
    const fallbackSeconds =
      nextMode === 'work'
        ? nextSettings.workMinutes * 60
        : nextMode === 'shortBreak'
          ? nextSettings.shortBreakMinutes * 60
          : nextSettings.longBreakMinutes * 60;

    setMode(nextMode);
    setSettings(nextSettings);
    setTask(state.task ?? '');
    setSecondsLeft(state.secondsLeft ?? fallbackSeconds);
    setIsRunning(!!state.isRunning);
    setCompletedPomodoros(state.completedPomodoros ?? 0);
  }, [user?.uid]);

  // Tick updates only — do not setSettings every second (that retriggered the reset effect)
  useEffect(() => {
    if (!user?.uid) return undefined;

    return subscribeToTimer((detail) => {
      if (!detail) return;
      if (detail.secondsLeft !== undefined) setSecondsLeft(detail.secondsLeft);
      if (detail.isRunning !== undefined) setIsRunning(detail.isRunning);
      if (detail.mode !== undefined) setMode(detail.mode);
      if (detail.task !== undefined) setTask(detail.task);
      if (detail.completedPomodoros !== undefined) {
        setCompletedPomodoros(detail.completedPomodoros);
      }
    });
  }, [user?.uid]);

  const modeSettingsKey = `${mode}-${settings.workMinutes}-${settings.shortBreakMinutes}-${settings.longBreakMinutes}`;

  useEffect(() => {
    if (prevModeSettingsKey.current === null) {
      prevModeSettingsKey.current = modeSettingsKey;
      return;
    }
    if (prevModeSettingsKey.current === modeSettingsKey) return;
    prevModeSettingsKey.current = modeSettingsKey;

    if (skipModeChangeRef.current) {
      skipModeChangeRef.current = false;
      return;
    }

    stopGlobalTimer();
    const nextSeconds = getDurationSeconds(mode);
    setIsRunning(false);
    setSecondsLeft(nextSeconds);
    if (user?.uid) {
      saveTimerState(user.uid, {
        mode,
        settings,
        task,
        secondsLeft: nextSeconds,
        isRunning: false,
        completedPomodoros,
      });
    }
  }, [modeSettingsKey, getDurationSeconds, user?.uid, mode, settings, task, completedPomodoros]); // eslint-disable-line react-hooks/exhaustive-deps -- task/completedPomodoros only used when saving after mode change

  useEffect(() => {
    if (!user?.uid) return undefined;
    const refreshStats = () => setStats(getPomodoroStats(user.uid));
    refreshStats();
    window.addEventListener(POMODORO_STATS_EVENT, refreshStats);
    window.addEventListener('pomodoro-timer-update', refreshStats);
    window.addEventListener('focus', refreshStats);
    return () => {
      window.removeEventListener(POMODORO_STATS_EVENT, refreshStats);
      window.removeEventListener('pomodoro-timer-update', refreshStats);
      window.removeEventListener('focus', refreshStats);
    };
  }, [user?.uid]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalSeconds = getDurationSeconds(mode);
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const ModeIcon = MODES[mode].icon;

  const handleStartPause = async () => {
    if (!user?.uid) return;

    if (!isRunning) {
      await unlockAudio();
      const next = {
        mode,
        settings,
        task,
        secondsLeft,
        isRunning: true,
        completedPomodoros,
      };
      saveTimerState(user.uid, next);
      startGlobalTimer(user.uid);
      setIsRunning(true);
    } else {
      stopGlobalTimer();
      const next = {
        mode,
        settings,
        task,
        secondsLeft,
        isRunning: false,
        completedPomodoros,
      };
      saveTimerState(user.uid, next);
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    if (!user?.uid) return;
    stopGlobalTimer();
    const newSeconds = getDurationSeconds(mode);
    setIsRunning(false);
    setSecondsLeft(newSeconds);
    saveTimerState(user.uid, {
      mode,
      settings,
      task,
      secondsLeft: newSeconds,
      isRunning: false,
      completedPomodoros,
    });
  };

  const handleSkip = () => {
    if (!user?.uid) return;
    stopGlobalTimer();
    skipModeChangeRef.current = true;

    if (mode === 'work') {
      const nextCount = completedPomodoros + 1;
      setCompletedPomodoros(nextCount);
      const nextMode =
        nextCount % settings.sessionsUntilLongBreak === 0 ? 'longBreak' : 'shortBreak';
      const newSeconds = getDurationSeconds(nextMode);
      setMode(nextMode);
      setSecondsLeft(newSeconds);
      setIsRunning(false);
      saveTimerState(user.uid, {
        mode: nextMode,
        settings,
        task,
        secondsLeft: newSeconds,
        isRunning: false,
        completedPomodoros: nextCount,
      });
    } else {
      const newSeconds = getDurationSeconds('work');
      setMode('work');
      setSecondsLeft(newSeconds);
      setIsRunning(false);
      saveTimerState(user.uid, {
        mode: 'work',
        settings,
        task,
        secondsLeft: newSeconds,
        isRunning: false,
        completedPomodoros,
      });
    }
  };

  const handleModeChange = (newMode) => {
    stopGlobalTimer();
    setIsRunning(false);
    setMode(newMode);
  };

  const handleTaskChange = (value) => {
    setTask(value);
    if (user?.uid) {
      saveTimerState(user.uid, {
        mode,
        settings,
        task: value,
        secondsLeft,
        isRunning,
        completedPomodoros,
      });
    }
  };

  const handleClearStats = () => {
    if (!user?.uid) return;
    if (!window.confirm('Clear all Pomodoro stats? This cannot be undone.')) return;
    clearPomodoroStats(user.uid);
    setStats(getPomodoroStats(user.uid));
    setCompletedPomodoros(0);
    toast.success('Stats cleared');
  };

  const timerSize = 280;
  const strokeWidth = 10;
  const radius = (timerSize - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center space-x-2 text-white hover:text-indigo-200 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-2">🍅 Pomodoro Timer</h1>
          <p className="text-indigo-100 text-lg">
            Stay focused with timed work sessions and refreshing breaks
          </p>
        </div>

        <NotificationBanner />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6 animate-slide-up">
            <Card>
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.entries(MODES).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => handleModeChange(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === key
                        ? `bg-gradient-to-r ${MODES[key].color} text-white shadow-md`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center py-6">
                <div className="relative mb-6" style={{ width: timerSize, height: timerSize }}>
                  <svg width={timerSize} height={timerSize} className="transform -rotate-90">
                    <circle
                      cx={timerSize / 2}
                      cy={timerSize / 2}
                      r={radius}
                      stroke="#f3f4f6"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <circle
                      cx={timerSize / 2}
                      cy={timerSize / 2}
                      r={radius}
                      stroke={MODES[mode].ring}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <ModeIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-5xl font-black text-gray-800 tracking-tight">
                      {formatTime(secondsLeft)}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">{MODES[mode].label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={handleReset}
                    className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    title="Reset"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleStartPause}
                    className={`p-5 rounded-full text-white shadow-lg transition-all ${
                      isRunning
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : `bg-gradient-to-r ${MODES[mode].color} hover:opacity-90`
                    }`}
                  >
                    {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
                  </button>
                  <button
                    onClick={handleSkip}
                    className="p-3 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    title="Skip"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={task}
                  onChange={(e) => handleTaskChange(e.target.value)}
                  placeholder="What are you working on? (optional)"
                  className="input-field w-full max-w-md text-center"
                />
              </div>
            </Card>

            <Card>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center text-gray-700 font-semibold mb-4 hover:text-indigo-600 transition-colors"
              >
                <Settings className="w-5 h-5 mr-2" />
                Timer Settings
                <span className="ml-2 text-sm text-gray-400">{showSettings ? '▲' : '▼'}</span>
              </button>
              {showSettings && (
                <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soundOn}
                    onChange={(e) => {
                      setSoundOn(e.target.checked);
                      setSoundEnabled(e.target.checked);
                    }}
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Alert sound when timer ends (works on laptop & phone browser)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Focus (min)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.workMinutes}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, workMinutes: parseInt(e.target.value, 10) || 25 }))
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Short Break (min)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.shortBreakMinutes}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          shortBreakMinutes: parseInt(e.target.value, 10) || 5,
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Long Break (min)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.longBreakMinutes}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          longBreakMinutes: parseInt(e.target.value, 10) || 15,
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pomodoros before long break
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      value={settings.sessionsUntilLongBreak}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          sessionsUntilLongBreak: parseInt(e.target.value, 10) || 4,
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                </div>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6 animate-slide-up">
            <Card>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Timer className="w-5 h-5 mr-2 text-indigo-600" />
                Session Stats
              </h2>
              <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Today</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.todaySessions}</p>
                  <p className="text-xs text-gray-500">pomodoros completed</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Sessions</p>
                  <p className="text-3xl font-bold text-green-600">{stats.totalSessions}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Focus Time
                  </p>
                  <p className="text-3xl font-bold text-orange-600">{stats.totalFocusMinutes}</p>
                  <p className="text-xs text-gray-500">minutes total</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Flame className="w-4 h-4 mr-1" />
                    Current Cycle
                  </p>
                  <p className="text-3xl font-bold text-rose-600">
                    {completedPomodoros % settings.sessionsUntilLongBreak} /{' '}
                    {settings.sessionsUntilLongBreak}
                  </p>
                  <p className="text-xs text-gray-500">until long break</p>
                </div>
              </div>
              {stats.totalSessions > 0 && (
                <button
                  onClick={handleClearStats}
                  className="mt-4 w-full text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear stats
                </button>
              )}
            </Card>

            <Card className="bg-indigo-50 border-0">
              <h3 className="font-semibold text-indigo-900 mb-2">How it works</h3>
              <ul className="text-sm text-indigo-800 space-y-2 list-disc list-inside">
                <li>Focus for {settings.workMinutes} minutes, then take a break</li>
                <li>After {settings.sessionsUntilLongBreak} sessions, enjoy a longer break</li>
                <li>Timer keeps running even if you switch tabs or pages ✨</li>
                <li>Alert sound plays on laptop or phone — click Start first so sound is allowed</li>
                <li>Enable notifications above for an extra popup + sound</li>
              </ul>
            </Card>

            <Card className="bg-amber-50 border border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-2">Sound & phone</h3>
              <p className="text-sm text-amber-800">
                Beep + vibration work on the same device (laptop speakers or phone browser). You do
                not need a separate mobile app for sound. Cross-device (laptop timer → phone beep)
                still needs a mobile app or PWA push later.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pomodoro;
