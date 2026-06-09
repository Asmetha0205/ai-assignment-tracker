import { alertUser, areNotificationsEnabled, isSoundEnabled, playAlertSound } from './notifications';

export const EXAM_REMINDER_DAYS = [7, 3, 1, 0];

const storageKey = (userId, examId, daysLeft) =>
  `exam_reminder_${userId}_${examId}_${daysLeft}`;

const alreadyNotifiedToday = (key) => {
  const stored = localStorage.getItem(key);
  if (!stored) return false;
  return stored === new Date().toDateString();
};

const markNotifiedToday = (key) => {
  localStorage.setItem(key, new Date().toDateString());
};

const getDaysLeft = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  return Math.round((exam - today) / (1000 * 60 * 60 * 24));
};

const messageForDays = (exam, daysLeft) => {
  const subject = exam.subject || exam.name;
  if (daysLeft === 0) {
    return {
      title: '🎯 Exam today!',
      body: `${exam.name} (${subject}) is today. Good luck!`,
    };
  }
  if (daysLeft === 1) {
    return {
      title: '📅 Exam tomorrow',
      body: `${exam.name} (${subject}) is in 1 day.`,
    };
  }
  return {
    title: `📅 ${daysLeft} days until exam`,
    body: `${exam.name} (${subject}) is coming up.`,
  };
};

export const checkExamReminders = (exams, userId) => {
  if (!userId || !Array.isArray(exams)) return;
  if (!areNotificationsEnabled() && !isSoundEnabled()) return;

  exams.forEach((exam) => {
    const daysLeft = getDaysLeft(exam.date);
    if (!EXAM_REMINDER_DAYS.includes(daysLeft)) return;

    const key = storageKey(userId, exam.id, daysLeft);
    if (alreadyNotifiedToday(key)) return;

    const { title, body } = messageForDays(exam, daysLeft);
    alertUser({
      title,
      body,
      tag: `exam-${exam.id}-${daysLeft}`,
      soundType: 'exam',
      onClick: () => {
        window.location.href = '/exams';
      },
    });
    markNotifiedToday(key);
  });
};
