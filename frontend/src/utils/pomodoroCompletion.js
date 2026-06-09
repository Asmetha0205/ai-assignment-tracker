import toast from 'react-hot-toast';
import { recordPomodoroSession } from './pomodoroStorage';
import { alertUser } from './notifications';
import { recordUserActivity } from '../api/services';
import { getTimerState, saveTimerState } from './pomodoroTimer';

const DEFAULT_SETTINGS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

const getDurationSeconds = (targetMode, settings) => {
  if (targetMode === 'work') return settings.workMinutes * 60;
  if (targetMode === 'shortBreak') return settings.shortBreakMinutes * 60;
  return settings.longBreakMinutes * 60;
};

/** Run when a pomodoro interval reaches zero (works on any page). */
export const handlePomodoroCompletion = (userId, user) => {
  if (!userId) return;

  const state = getTimerState(userId);
  if (!state) return;

  const settings = { ...DEFAULT_SETTINGS, ...state.settings };
  const task = (state.task || '').trim();
  let completedPomodoros = state.completedPomodoros || 0;
  let nextMode = state.mode;

  if (state.mode === 'work') {
    completedPomodoros += 1;

    recordPomodoroSession(userId, {
      focusMinutes: settings.workMinutes,
      task,
    });

    if (user) {
      recordUserActivity(user).catch((error) => {
        console.error('Failed to record user activity:', error);
      });
    }

    toast.success('Pomodoro complete! Great focus session.');

    if (completedPomodoros % settings.sessionsUntilLongBreak === 0) {
      nextMode = 'longBreak';
      toast('Time for a long break!', { icon: '☕' });
      alertUser({
        title: '🍅 Session complete — long break!',
        body: task
          ? `"${task}" done. Take ${settings.longBreakMinutes} minutes off.`
          : `Take a ${settings.longBreakMinutes}-minute long break.`,
        tag: 'pomodoro-long-break',
        soundType: 'timer',
      });
    } else {
      nextMode = 'shortBreak';
      toast('Take a short break!', { icon: '🌿' });
      alertUser({
        title: '🍅 Session complete — break time!',
        body: task
          ? `"${task}" done. Take ${settings.shortBreakMinutes} minutes off.`
          : `Take a ${settings.shortBreakMinutes}-minute break.`,
        tag: 'pomodoro-short-break',
        soundType: 'timer',
      });
    }
  } else {
    nextMode = 'work';
    toast.success('Break over — back to focus!');
    alertUser({
      title: '🎯 Break finished',
      body: 'Ready for another focus session?',
      tag: 'pomodoro-break-done',
      soundType: 'break',
    });
  }

  saveTimerState(userId, {
    ...state,
    settings,
    mode: nextMode,
    completedPomodoros,
    secondsLeft: getDurationSeconds(nextMode, settings),
    isRunning: false,
  });
};
