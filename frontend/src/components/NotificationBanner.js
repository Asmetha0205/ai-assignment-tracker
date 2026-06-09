import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  areNotificationsEnabled,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '../utils/notifications';

const NotificationBanner = ({ compact = false }) => {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [enabled, setEnabled] = useState(areNotificationsEnabled());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
    setEnabled(areNotificationsEnabled());
  }, []);

  if (!isNotificationSupported() || dismissed || enabled) {
    return null;
  }

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    setEnabled(result.granted);
    if (result.granted) {
      toast.success('Notifications enabled!');
      setDismissed(true);
    } else if (result.reason === 'denied') {
      toast.error('Notifications blocked. Enable them in your browser settings.');
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleEnable}
        className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Bell className="w-4 h-4" />
        Enable alerts
      </button>
    );
  }

  return (
    <div className="mb-6 bg-white/95 border border-indigo-200 rounded-xl p-4 shadow-md flex items-start gap-4">
      <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
        {permission === 'denied' ? (
          <BellOff className="w-5 h-5 text-red-500" />
        ) : (
          <Bell className="w-5 h-5 text-indigo-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">Enable study alerts</p>
        <p className="text-sm text-gray-600 mt-1">
          Get a loud beep + popup when your Pomodoro ends or an exam is near. Sound works on
          laptop and phone browser — click Start on the timer first so audio is allowed.
        </p>
        {permission === 'denied' ? (
          <p className="text-xs text-red-600 mt-2">
            Notifications are blocked. Allow them in your browser site settings, then refresh.
          </p>
        ) : (
          <button
            onClick={handleEnable}
            className="mt-3 btn-primary text-sm py-2 px-4"
          >
            Enable notifications
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default NotificationBanner;
