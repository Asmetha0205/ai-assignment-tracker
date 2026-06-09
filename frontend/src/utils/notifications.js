const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';
const SOUND_ENABLED_KEY = 'alert_sound_enabled';

let audioContext = null;

export const isNotificationSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const areNotificationsEnabled = () => {
  if (!isNotificationSupported()) return false;
  return (
    localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true' &&
    Notification.permission === 'granted'
  );
};

export const isSoundEnabled = () => localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';

export const setSoundEnabled = (enabled) => {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
};

export const setNotificationsEnabled = (enabled) => {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
};

/** Call on button click (Start timer) so browser allows sound later */
export const unlockAudio = async () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    return true;
  } catch {
    return false;
  }
};

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    return { granted: false, reason: 'unsupported' };
  }
  if (Notification.permission === 'granted') {
    setNotificationsEnabled(true);
    return { granted: true };
  }
  if (Notification.permission === 'denied') {
    setNotificationsEnabled(false);
    return { granted: false, reason: 'denied' };
  }
  const result = await Notification.requestPermission();
  const granted = result === 'granted';
  setNotificationsEnabled(granted);
  return { granted, reason: granted ? null : result };
};

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const playBeep = (ctx, freq, start, duration, volume = 0.5, wave = 'square') => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = wave;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
  osc.start(start);
  osc.stop(start + duration);
};

/** Loud alert — works on laptop & phone browser when tab is open */
export const playAlertSound = async (type = 'timer') => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;

    if (type === 'exam') {
      playBeep(ctx, 600, now, 0.2, 0.45);
      playBeep(ctx, 800, now + 0.25, 0.2, 0.45);
      playBeep(ctx, 1000, now + 0.5, 0.35, 0.5);
    } else if (type === 'break') {
      playBeep(ctx, 523, now, 0.25, 0.35, 'sine');
      playBeep(ctx, 659, now + 0.3, 0.35, 0.35, 'sine');
    } else {
      // Timer done — triple alarm beep (easy to hear)
      playBeep(ctx, 880, now, 0.22, 0.55);
      playBeep(ctx, 880, now + 0.35, 0.22, 0.55);
      playBeep(ctx, 1100, now + 0.7, 0.35, 0.6);
      playBeep(ctx, 880, now + 1.15, 0.22, 0.55);
      playBeep(ctx, 1100, now + 1.5, 0.4, 0.65);
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(type === 'timer' ? [300, 120, 300, 120, 500] : [200, 100, 200]);
    }
  } catch (e) {
    console.warn('Alert sound blocked:', e);
  }
};

export const showBrowserNotification = (title, options = {}) => {
  if (!areNotificationsEnabled()) return null;
  try {
    const notification = new Notification(title, {
      icon: `${window.location.origin}/logo192.png`,
      badge: `${window.location.origin}/logo192.png`,
      requireInteraction: false,
      ...options,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };
    setTimeout(() => notification.close(), 12000);
    return notification;
  } catch {
    return null;
  }
};

/** Sound always plays (if enabled). Notification only if permission granted. */
export const alertUser = async ({
  title,
  body,
  tag,
  onClick,
  playSound = true,
  soundType = 'timer',
}) => {
  if (playSound) {
    await playAlertSound(soundType);
  }
  showBrowserNotification(title, { body, tag, onClick });
};
