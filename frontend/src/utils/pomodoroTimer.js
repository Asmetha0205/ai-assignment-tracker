/**
 * Global Pomodoro Timer Manager
 * Runs independently of React components - timer continues even when navigating away
 */

const TIMER_STATE_KEY = 'pomodoro_timer_state';
const TIMER_EVENT = 'pomodoro-timer-update';

let globalInterval = null;

const readRawTimerState = (userId) => {
  if (!userId) return null;
  try {
    const saved = localStorage.getItem(`${TIMER_STATE_KEY}_${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

// Get current timer state (adjusts for elapsed time when resuming after navigation)
export const getTimerState = (userId) => {
  const state = readRawTimerState(userId);
  if (!state) return null;

  if (state.isRunning && state.savedAt) {
    const elapsed = Math.floor((Date.now() - state.savedAt) / 1000);
    state.secondsLeft = Math.max(0, state.secondsLeft - elapsed);

    if (state.secondsLeft === 0) {
      state.isRunning = false;
    }
  }

  return state;
};

// Save timer state
export const saveTimerState = (userId, state) => {
  if (!userId) return;
  localStorage.setItem(`${TIMER_STATE_KEY}_${userId}`, JSON.stringify({
    ...state,
    savedAt: Date.now(),
  }));
  
  // Notify all listeners
  window.dispatchEvent(new CustomEvent(TIMER_EVENT, { detail: state }));
};

// Clear timer state
export const clearTimerState = (userId) => {
  if (!userId) return;
  localStorage.removeItem(`${TIMER_STATE_KEY}_${userId}`);
  window.dispatchEvent(new CustomEvent(TIMER_EVENT, { detail: null }));
};

// Start global timer
export const startGlobalTimer = (userId) => {
  if (!userId) return;
  
  // Stop existing timer
  stopGlobalTimer();
  
  // Start new interval
  globalInterval = setInterval(() => {
    const state = readRawTimerState(userId);
    if (!state || !state.isRunning) {
      stopGlobalTimer();
      return;
    }

    if (state.secondsLeft > 0) {
      state.secondsLeft -= 1;
      saveTimerState(userId, state);
    } else {
      // Timer finished
      state.isRunning = false;
      state.secondsLeft = 0;
      saveTimerState(userId, state);
      stopGlobalTimer();
      
      // Trigger completion event
      window.dispatchEvent(new CustomEvent('pomodoro-timer-complete', { 
        detail: { mode: state.mode, task: state.task } 
      }));
    }
  }, 1000);
};

// Stop global timer
export const stopGlobalTimer = () => {
  if (globalInterval) {
    clearInterval(globalInterval);
    globalInterval = null;
  }
};

// Subscribe to timer updates
export const subscribeToTimer = (callback) => {
  const handler = (e) => callback(e.detail);
  window.addEventListener(TIMER_EVENT, handler);
  return () => window.removeEventListener(TIMER_EVENT, handler);
};

// Subscribe to timer completion
export const subscribeToCompletion = (callback) => {
  const handler = (e) => callback(e.detail);
  window.addEventListener('pomodoro-timer-complete', handler);
  return () => window.removeEventListener('pomodoro-timer-complete', handler);
};

// Initialize timer on app load (resume if was running)
export const initializeTimer = (userId) => {
  if (!userId) return;

  const raw = readRawTimerState(userId);
  if (!raw?.isRunning) return;

  if (raw.savedAt) {
    const elapsed = Math.floor((Date.now() - raw.savedAt) / 1000);
    const secondsLeft = Math.max(0, raw.secondsLeft - elapsed);

    if (secondsLeft === 0) {
      saveTimerState(userId, { ...raw, secondsLeft: 0, isRunning: false });
      window.dispatchEvent(
        new CustomEvent('pomodoro-timer-complete', {
          detail: { mode: raw.mode, task: raw.task },
        })
      );
      return;
    }

    saveTimerState(userId, { ...raw, secondsLeft, isRunning: true });
    startGlobalTimer(userId);
    return;
  }

  if (raw.secondsLeft > 0) {
    startGlobalTimer(userId);
  }
};
