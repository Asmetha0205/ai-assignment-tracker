import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import { getProgress, loadStudyPlan } from '../api/services';
import { getPomodoroStats, POMODORO_STATS_EVENT } from '../utils/pomodoroStorage';
import axios from '../api/axios';
import {
  Timer,
  FileText,
  Bot,
  TrendingUp,
  Trophy,
  Target,
  Flame,
  Award,
  Layers,
  CalendarDays,
  ChevronRight,
  ListChecks,
  BookOpen,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  Rocket,
  Zap,
  CheckCircle
} from 'lucide-react';

// --- Helpers ---

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (hour < 21) return { text: 'Good evening', emoji: '🌅' };
  return { text: 'Burning the midnight oil', emoji: '🌙' };
};

const TIPS = [
  { text: 'Use the Pomodoro technique — 25 min focus, 5 min break — to stay productive without burnout.', icon: Timer },
  { text: 'Summarize your notes right after a lecture. The sooner you review, the more you retain.', icon: FileText },
  { text: 'Test yourself with quizzes instead of re-reading. Active recall is 2x more effective.', icon: ListChecks },
  { text: 'Flashcards work best with spaced repetition. Review them daily for long-term memory.', icon: Layers },
  { text: 'Break big topics into smaller chunks. Your brain learns better in bite-sized pieces.', icon: BookOpen },
  { text: 'Take a 5-minute walk between study sessions. Movement boosts focus and memory.', icon: Rocket },
  { text: 'Teach what you learned to someone else — it\'s the fastest way to find gaps in your understanding.', icon: Lightbulb },
  { text: 'Study your hardest subjects first while your energy is highest.', icon: Zap },
];

const getTipOfTheDay = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return TIPS[dayOfYear % TIPS.length];
};

const MOTIVATIONAL_MESSAGES = {
  noPlan: [
    "Create a study plan to get started! Upload your syllabus 📚",
    "Ready to plan? Your AI study schedule is just a click away! 🚀",
  ],
  zero: [
    "Fresh start! Open your study plan and tackle today's topics 💪",
    "Your plan is waiting — dive into your first topic! 🌟",
  ],
  low: [
    "Great start! Keep checking off those topics! 🔥",
    "You're making progress — stay consistent! 💫",
  ],
  mid: [
    "More than halfway there — keep it up! 🔥🔥",
    "Incredible discipline — you're on a roll! ⚡",
  ],
  high: [
    "Almost done with your plan! You're crushing it! 🏆",
    "Outstanding progress — finish strong! 🎯",
  ],
  done: [
    "Study plan complete! You're a champion! 🥇",
    "All topics done! Time to ace that exam! 🎉",
  ],
};

const getMotivation = (progress, hasPlan) => {
  if (!hasPlan) {
    const pool = MOTIVATIONAL_MESSAGES.noPlan;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let pool;
  if (progress === 0) pool = MOTIVATIONAL_MESSAGES.zero;
  else if (progress < 40) pool = MOTIVATIONAL_MESSAGES.low;
  else if (progress < 75) pool = MOTIVATIONAL_MESSAGES.mid;
  else if (progress < 100) pool = MOTIVATIONAL_MESSAGES.high;
  else pool = MOTIVATIONAL_MESSAGES.done;
  return pool[Math.floor(Math.random() * pool.length)];
};

// --- Skeleton Components ---

const SkeletonStatCard = () => (
  <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-3 bg-gray-200 rounded w-24"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
    </div>
  </div>
);

const SkeletonProgressWidget = () => (
  <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse lg:col-span-2">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 bg-gray-200 rounded w-32"></div>
      <div className="h-8 bg-gray-200 rounded w-12"></div>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-4 mb-4"></div>
    <div className="flex justify-between">
      <div className="h-4 bg-gray-200 rounded w-28"></div>
      <div className="h-4 bg-gray-200 rounded w-28"></div>
    </div>
  </div>
);

const SkeletonExamWidget = () => (
  <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl shadow-lg p-6 animate-pulse">
    <div className="h-6 bg-white/20 rounded w-36 mb-4"></div>
    <div className="space-y-3">
      <div className="h-12 bg-white/10 rounded-xl"></div>
      <div className="h-12 bg-white/10 rounded-xl"></div>
    </div>
  </div>
);

// --- Main Component ---

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    todayPomodoros: 0,
    totalPomodoros: 0,
    focusMinutes: 0,
    streak: 0,
    points: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [motivation, setMotivation] = useState('');
  const [studyPlan, setStudyPlan] = useState(null);
  const [completedTopics, setCompletedTopics] = useState([]);

  // Study plan helpers
  const getTopicsForDay = (day) => {
    if (day && day.time_slots && day.time_slots.length > 0) {
      return day.time_slots.filter(s => s.type === 'study').map(s => s.activity);
    }
    if (day && day.topics && day.topics.length > 0) return day.topics;
    return [];
  };

  const allPlanTopics = (studyPlan?.schedule || []).flatMap(d => getTopicsForDay(d));
  const planTotalTopics = allPlanTopics.length;
  const planCompletedCount = completedTopics.length;
  const planProgress = planTotalTopics > 0 ? Math.round((planCompletedCount / planTotalTopics) * 100) : 0;

  const dailyGoal = 8;
  const greeting = getGreeting();
  const tip = getTipOfTheDay();

  // Full fetch: localStorage + API (for streak/points from backend)
  const fetchUserProgress = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    try {
      const pomodoroStats = getPomodoroStats(user.uid);
      const response = await getProgress(user.uid);
      const userData = response?.success ? response.user || {} : {};

      setStats({
        todayPomodoros: pomodoroStats.todaySessions,
        totalPomodoros: pomodoroStats.totalSessions,
        focusMinutes: pomodoroStats.totalFocusMinutes,
        streak: userData.streak || 0,
        points: userData.total_points || 0,
      });
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Fast refresh: only re-read pomodoro stats from localStorage (no API call)
  const refreshLocalStats = useCallback(() => {
    if (!user?.uid) return;
    const pomodoroStats = getPomodoroStats(user.uid);
    setStats(prev => ({
      ...prev,
      todayPomodoros: pomodoroStats.todaySessions,
      totalPomodoros: pomodoroStats.totalSessions,
      focusMinutes: pomodoroStats.totalFocusMinutes,
    }));
  }, [user?.uid]);

  useEffect(() => {
    fetchUserProgress();
    fetchExams();
  }, [fetchUserProgress]);

  useEffect(() => {
    const onStatsUpdate = (e) => {
      if (!user?.uid || e.detail?.userId === user.uid) refreshLocalStats();
    };
    window.addEventListener('focus', fetchUserProgress);
    window.addEventListener(POMODORO_STATS_EVENT, onStatsUpdate);
    return () => {
      window.removeEventListener('focus', fetchUserProgress);
      window.removeEventListener(POMODORO_STATS_EVENT, onStatsUpdate);
    };
  }, [user?.uid, fetchUserProgress, refreshLocalStats]);

  // Set motivation based on study plan progress
  useEffect(() => {
    if (!loading) {
      setMotivation(getMotivation(planProgress, !!studyPlan));
    }
  }, [loading, planProgress, studyPlan]);


  const fetchExams = async () => {
    if (!user?.uid) return;
    try {
      const res = await axios.get(`/api/exams/${user.uid}`);
      if (res.data.success) {
        const parsedExams = res.data.exams || [];
        const upcoming = parsedExams
          .filter(e => {
            const days = Math.round((new Date(e.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
            return days >= 0;
          })
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3);
        setExams(upcoming);
      }
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchStudyPlan = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await loadStudyPlan(user.uid);
      if (res.success && res.study_plan) {
        setStudyPlan(res.study_plan);
        setCompletedTopics(res.completed_topics || []);
      }
    } catch (error) {
      console.error('Error fetching study plan:', error);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchStudyPlan();
  }, [fetchStudyPlan]);



  // Find today's day in plan (approximate by day index)
  const todayDayIndex = studyPlan?.schedule?.[0] ? (() => {
    const planStart = studyPlan.created_at ? new Date(studyPlan.created_at) : null;
    if (!planStart) return 1;
    const diffDays = Math.floor((Date.now() - planStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(diffDays, studyPlan.schedule.length);
  })() : 1;
  const todaySchedule = studyPlan?.schedule?.find(d => d.day === todayDayIndex);
  const todayTopics = todaySchedule ? getTopicsForDay(todaySchedule) : [];
  const todayCompleted = todayTopics.filter(t => completedTopics.includes(t)).length;

  const features = [
    {
      title: 'AI Study Planner',
      description: 'Upload your syllabus and get a personalized day-by-day study schedule',
      icon: BookOpen,
      link: '/study-plan',
      color: 'from-violet-500 to-indigo-600',
    },
    {
      title: 'Notes Summarizer',
      description: 'Summarize long notes into concise, easy-to-understand points',
      icon: FileText,
      link: '/summarizer',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'AI Assistant',
      description: 'Get explanations and answers to your study questions',
      icon: Bot,
      link: '/assistant',
      color: 'from-green-500 to-teal-500',
    },
    {
      title: 'Flashcard Generator',
      description: 'Create interactive flashcards from your notes or PDFs',
      icon: Layers,
      link: '/flashcards',
      color: 'from-teal-500 to-emerald-500',
    },
    {
      title: 'Quiz Generator',
      description: 'Test your knowledge with AI-generated quizzes',
      icon: ListChecks,
      link: '/quiz',
      color: 'from-indigo-500 to-blue-500',
    },
    {
      title: 'Pomodoro Timer',
      description: 'Stay focused with timed work sessions and structured breaks',
      icon: Timer,
      link: '/pomodoro',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Progress Tracker',
      description: 'Detailed analytics and insights into your study habits',
      icon: TrendingUp,
      link: '/progress',
      color: 'from-orange-500 to-red-500',
    },
    {
      title: 'Leaderboard',
      description: 'Challenge yourself and see how you rank among others',
      icon: Trophy,
      link: '/leaderboard',
      color: 'from-yellow-500 to-orange-500',
    },
  ];

  const statCards = [
    { label: "Today's Pomodoros", value: stats.todayPomodoros, icon: Target, color: 'bg-blue-500' },
    { label: 'Total Sessions', value: stats.totalPomodoros, icon: Timer, color: 'bg-green-500' },
    { label: 'Streak', value: `${stats.streak} days`, icon: Flame, color: 'bg-orange-500' },
    { label: 'Points', value: stats.points, icon: Award, color: 'bg-purple-500' },
  ];

  const completionPercentage = Math.min(
    100,
    Math.round((stats.todayPomodoros / dailyGoal) * 100)
  );

  // Find urgent exams (≤ 3 days away)
  const urgentExams = exams.filter(exam => {
    const days = Math.round((new Date(exam.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    return days <= 3;
  });

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Urgent Exam Banner */}
        {!loading && urgentExams.length > 0 && (
          <div className="mb-6 animate-fade-in">
            {urgentExams.map(exam => {
              const days = Math.round((new Date(exam.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
              return (
                <Link to="/exams" key={exam.id}>
                  <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-xl p-4 mb-2 flex items-center justify-between shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm sm:text-base">
                          {days === 0 ? '🚨 TODAY' : days === 1 ? '⏰ Tomorrow' : `⚠️ ${days} days left`}
                          <span className="font-medium ml-2">— {exam.name}</span>
                          {exam.subject && <span className="opacity-75 ml-1">({exam.subject})</span>}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            {greeting.emoji} {greeting.text}, {user?.displayName || 'Student'}!
          </h1>
          <p className="text-indigo-100 text-lg">Your AI-powered study companion is ready.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            statCards.map((stat, i) => (
              <div key={i} className="stagger-item" style={{ animationDelay: `${i * 80}ms` }}>
                <Card hover>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                      {/* Empty state encouragement for first card */}
                      {i === 0 && stats.todayPomodoros === 0 && (
                        <p className="text-xs text-indigo-500 font-medium mt-1">
                          Start your first session! →
                        </p>
                      )}
                      {i === 1 && stats.totalPomodoros === 0 && (
                        <p className="text-xs text-green-500 font-medium mt-1">
                          Try the Pomodoro Timer →
                        </p>
                      )}
                    </div>
                    <div className={`${stat.color} p-3 rounded-xl shadow-lg`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Card>
              </div>
            ))
          )}
        </div>

        {/* Focus + Exam Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {loading ? (
            <>
              <SkeletonProgressWidget />
              <SkeletonExamWidget />
            </>
          ) : (
            <>
              {/* Study Plan Progress Widget */}
              <div className="lg:col-span-2 stagger-item" style={{ animationDelay: '320ms' }}>
                <Link to="/study-plan" className="block">
                  <Card hover className="h-full">
                    {studyPlan ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-gray-800 flex items-center">
                            <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
                            Study Plan Progress
                          </h3>
                          <span className="text-2xl font-black text-indigo-600">{planProgress}%</span>
                        </div>

                        {/* Motivation text */}
                        <p className="text-sm text-gray-500 mb-3 italic">{motivation}</p>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-3 relative">
                          <div
                            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-4 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${planProgress}%` }}
                          />
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                          <span className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                            <span className="font-semibold text-indigo-700">{planCompletedCount}</span>
                            <span className="mx-1">/</span>
                            <span>{planTotalTopics} topics completed</span>
                          </span>
                          <span>{studyPlan.total_days || '—'} day plan</span>
                        </div>

                        {/* Today's focus */}
                        {todaySchedule && (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-indigo-600 mb-1">📅 Today — Day {todayDayIndex}: {todaySchedule.focus || 'Study Session'}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">{todayCompleted}/{todayTopics.length} topics done today</span>
                              {todayCompleted === todayTopics.length && todayTopics.length > 0 && (
                                <span className="text-xs font-bold text-green-600">✅ All done!</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 text-indigo-300" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Create Your Study Plan</h3>
                        <p className="text-sm text-gray-500 mb-3">Upload your syllabus and get a personalized schedule</p>
                        <span className="inline-flex items-center text-indigo-600 font-bold text-sm">
                          Get Started <ChevronRight className="w-4 h-4 ml-1" />
                        </span>
                      </div>
                    )}
                  </Card>
                </Link>
              </div>

              {/* Exam Widget */}
              <div className="lg:col-span-1 stagger-item" style={{ animationDelay: '400ms' }}>
                <Link to="/exams" className="block h-full">
                  <Card hover className="h-full bg-gradient-to-br from-indigo-900 to-purple-900 text-white border-0 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center">
                        <CalendarDays className="w-5 h-5 mr-2 text-indigo-300" />
                        Upcoming Exams
                      </h3>
                      <ChevronRight className="w-5 h-5 opacity-50" />
                    </div>
                    <div className="space-y-3">
                      {exams.length === 0 ? (
                        <div className="text-center py-6 bg-white/10 rounded-xl">
                          <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm opacity-80">No exams added yet</p>
                          <p className="text-xs opacity-50 mt-1">Tap to add your first exam</p>
                        </div>
                      ) : (
                        exams.map(exam => {
                          const days = Math.round((new Date(exam.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                          return (
                            <div key={exam.id} className="flex items-center justify-between bg-white/10 p-3 rounded-xl hover:bg-white/15 transition-colors">
                              <div className="min-w-0 mr-3">
                                <p className="text-sm font-bold truncate">{exam.name}</p>
                                <p className="text-xs opacity-60 truncate">{exam.subject}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${days <= 3 ? 'bg-red-500' : 'bg-green-500'}`}>
                                  {days === 0 ? 'Today' : `${days}d`}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Tip of the Day */}
        <div className="mb-8 stagger-item" style={{ animationDelay: '480ms' }}>
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
            <div className="flex items-start space-x-4">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-xl shadow-md flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-sm font-bold text-amber-800">Tip of the Day</h3>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <p className="text-sm text-amber-900/80 leading-relaxed">{tip.text}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Features Grid */}
        <h2 className="text-2xl font-bold text-white mb-6 stagger-item" style={{ animationDelay: '540ms' }}>
          Explore Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Link key={i} to={feature.link}>
              <div className="stagger-item" style={{ animationDelay: `${600 + i * 60}ms` }}>
                <Card hover className="h-full flex flex-col">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 md:line-clamp-none">{feature.description}</p>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center text-indigo-600 font-bold text-sm">
                    <span>Open Tool</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </Card>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
