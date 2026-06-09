import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalDateKey } from '../utils/pomodoroStorage';
import Card from '../components/Card';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Upload, FileText, Calendar, Loader2,
  CheckCircle, Circle, ChevronDown, ChevronUp,
  BookOpen, Clock, Coffee, Trash2, RefreshCw, Download, X
} from 'lucide-react';

const StudyPlanner = ({ user }) => {
  const navigate = useNavigate();

  // ── Input state ──────────────────────────────────────────────────────────
  const [syllabusText, setSyllabusText] = useState('');
  const [file, setFile] = useState(null);
  const [daysAvailable, setDaysAvailable] = useState(30);
  const [examDate, setExamDate] = useState('');

  // ── Plan state ───────────────────────────────────────────────────────────
  const [studyPlan, setStudyPlan] = useState(null);
  const [completedTopics, setCompletedTopics] = useState([]);
  const [expandedDays, setExpandedDays] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const loadingTimerRef = useRef(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [phase, setPhase] = useState('input'); // 'input' | 'plan'

  // ── Load saved plan on mount ─────────────────────────────────────────────
  const loadSavedPlan = useCallback(async () => {
    if (!user?.uid) { setLoadingPlan(false); return; }
    try {
      const res = await axios.get('/api/study-plan/load', { params: { user_id: user.uid } });
      if (res.data.success && res.data.study_plan) {
        setStudyPlan(res.data.study_plan);
        setCompletedTopics(res.data.completed_topics || []);
        if (res.data.exam_date) setExamDate(res.data.exam_date);
        setPhase('plan');
        // Expand first day by default
        setExpandedDays({ 1: true });
      }
    } catch (e) {
      console.error('Error loading plan:', e);
    } finally {
      setLoadingPlan(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadSavedPlan(); }, [loadSavedPlan]);

  // ── File handling ────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    const allowed = ['application/pdf', 'text/plain', 'application/zip',
      'application/x-zip-compressed', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(selected.type) && !selected.name.match(/\.(pdf|txt|zip|doc|docx)$/i)) {
      toast.error('Supported formats: PDF, TXT, DOC, DOCX, ZIP');
      return;
    }
    setFile(selected);
    setSyllabusText('');
    toast.success(`${selected.name} selected!`);
  };

  const removeFile = () => setFile(null);

  // ── Calculate days from exam date ────────────────────────────────────────
  const handleExamDateChange = (e) => {
    const date = e.target.value;
    setExamDate(date);
    if (date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const exam = new Date(date); exam.setHours(0, 0, 0, 0);
      const diff = Math.round((exam - today) / (1000 * 60 * 60 * 24));
      if (diff > 0) setDaysAvailable(diff);
    }
  };

  // ── Generate plan ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!file && syllabusText.trim().length < 50) {
      toast.error('Please upload a file or paste at least 50 characters of syllabus');
      return;
    }
    setLoading(true);

    // Rotating loading messages
    const steps = [
      'Reading your syllabus...',
      'Extracting topics with AI...',
      'Building your schedule...',
      'Assigning time slots...',
      'Saving your plan...',
    ];
    let stepIdx = 0;
    setLoadingStep(steps[0]);
    loadingTimerRef.current = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setLoadingStep(steps[stepIdx]);
    }, 4000);

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.uid);
        formData.append('days', daysAvailable);
        if (examDate) formData.append('exam_date', examDate);
        res = await axios.post('/api/study-plan/generate', formData);
      } else {
        res = await axios.post('/api/study-plan/generate', {
          syllabus: syllabusText,
          days: daysAvailable,
          exam_date: examDate,
          user_id: user.uid,
        });
      }

      if (res.data.success) {
        setStudyPlan(res.data.study_plan);
        setCompletedTopics([]);
        setExpandedDays({ 1: true });
        setPhase('plan');
        toast.success('Study plan generated and saved!');
      } else {
        toast.error(res.data.error || 'Failed to generate study plan');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to generate study plan');
    } finally {
      clearInterval(loadingTimerRef.current);
      setLoadingStep('');
      setLoading(false);
    }
  };

  // ── Toggle topic completion ──────────────────────────────────────────────
  const toggleTopic = async (topic) => {
    const isCompleted = completedTopics.includes(topic);
    const updated = isCompleted
      ? completedTopics.filter(t => t !== topic)
      : [...completedTopics, topic];
    setCompletedTopics(updated);

    try {
      await axios.post('/api/progress/update', {
        user_id: user.uid,
        plan_id: user.uid,
        topic,
        completed: !isCompleted,
        date_key: getLocalDateKey(),
      });
    } catch (e) {
      console.error('Error updating topic:', e);
    }
  };

  // ── Toggle day expand/collapse ───────────────────────────────────────────
  const toggleDay = (day) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  // ── Delete plan ──────────────────────────────────────────────────────────
  const handleDeletePlan = async () => {
    if (!window.confirm('Delete your current study plan? This cannot be undone.')) return;
    try {
      await axios.delete('/api/study-plan/delete', { data: { user_id: user.uid } });
      setStudyPlan(null);
      setCompletedTopics([]);
      setPhase('input');
      setSyllabusText('');
      setFile(null);
      toast.success('Study plan deleted');
    } catch (e) {
      // Even if delete fails, reset UI
      setStudyPlan(null);
      setCompletedTopics([]);
      setPhase('input');
      toast.success('Study plan cleared');
    }
  };

  // ── Export plan as text ──────────────────────────────────────────────────
  const handleExport = () => {
    if (!studyPlan) return;
    const schedule = studyPlan.schedule || [];
    let content = `AI STUDY PLAN\n${'='.repeat(40)}\n\n`;
    content += `Overview: ${studyPlan.overview || ''}\n`;
    content += `Total Days: ${studyPlan.total_days || daysAvailable}\n`;
    content += `Total Topics: ${studyPlan.total_topics || 0}\n\n`;
    schedule.forEach(day => {
      content += `DAY ${day.day} — ${day.focus || ''}\n${'-'.repeat(30)}\n`;
      (day.time_slots || []).forEach(slot => {
        content += `  ${slot.time}  |  ${slot.activity}\n`;
      });
      if (day.tips) content += `  💡 Tip: ${day.tips}\n`;
      content += '\n';
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'study-plan.txt'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Study plan exported!');
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getTopicsForDay = (day) => {
    // Support both time_slots format and legacy topics array
    if (day.time_slots && day.time_slots.length > 0) {
      return day.time_slots
        .filter(s => s.type === 'study')
        .map(s => s.activity);
    }
    if (day.topics && day.topics.length > 0) {
      return day.topics;
    }
    return [];
  };

  const getDayProgress = (day) => {
    const topics = getTopicsForDay(day);
    if (!topics.length) return 0;
    const done = topics.filter(t => completedTopics.includes(t)).length;
    return Math.round((done / topics.length) * 100);
  };

  const totalTopics = (studyPlan?.schedule || []).flatMap(d => getTopicsForDay(d)).length;
  const overallProgress = totalTopics > 0
    ? Math.round((completedTopics.length / totalTopics) * 100)
    : 0;

  const today = new Date().toISOString().split('T')[0];

  // ── Loading state ────────────────────────────────────────────────────────
  if (loadingPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading your study plan...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <button onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center space-x-2 text-white hover:text-indigo-200 transition-all">
          <ArrowLeft className="w-5 h-5" /><span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-8 animate-fade-in flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">📚 AI Study Planner</h1>
            <p className="text-white/80 text-lg">Upload your syllabus and get a personalized day-by-day study schedule</p>
          </div>
          {phase === 'plan' && (
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all shadow">
                <Download className="w-4 h-4" /><span>Export</span>
              </button>
              <button onClick={() => setPhase('input')}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all border border-white/30">
                <RefreshCw className="w-4 h-4" /><span>New Plan</span>
              </button>
              <button onClick={handleDeletePlan}
                className="flex items-center space-x-2 px-4 py-2.5 bg-red-500/80 hover:bg-red-600 text-white rounded-xl font-semibold transition-all">
                <Trash2 className="w-4 h-4" /><span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* ── INPUT PHASE ─────────────────────────────────────────────────── */}
        {phase === 'input' && (
          <Card className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
              Create Your Study Plan
            </h2>

            {/* File Upload */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Syllabus (PDF, TXT, DOC, ZIP)
              </label>
              {file ? (
                <div className="border border-indigo-300 bg-indigo-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm text-gray-700 truncate max-w-xs">{file.name}</span>
                  </div>
                  <button onClick={removeFile} className="p-1 hover:bg-indigo-200 rounded transition-colors">
                    <X className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-all cursor-pointer">
                  <input type="file" accept=".pdf,.txt,.doc,.docx,.zip"
                    onChange={handleFileChange} className="hidden" id="syllabus-upload" />
                  <label htmlFor="syllabus-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                    <p className="text-gray-400 text-sm mt-1">PDF, TXT, DOC, DOCX, ZIP up to 10MB</p>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="px-4 text-gray-400 text-sm font-medium">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Text Input */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Paste Syllabus Text</label>
              <textarea
                value={syllabusText}
                onChange={e => setSyllabusText(e.target.value)}
                disabled={!!file}
                className="input-field min-h-[180px] font-mono text-sm w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={file ? 'File uploaded — click Generate Study Plan' : 'Paste your syllabus, course outline, or list of topics here...'}
              />
              {!file && (
                <p className="text-xs text-gray-400 mt-1 text-right">{syllabusText.length} characters</p>
              )}
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-1 text-indigo-500" />
                  Exam Date (optional)
                </label>
                <input
                  type="date"
                  min={today}
                  value={examDate}
                  onChange={handleExamDateChange}
                  className="input-field w-full"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-calculates days available</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-indigo-500" />
                  Days Available: <span className="ml-1 font-bold text-indigo-600">{daysAvailable}</span>
                </label>
                <input
                  type="range"
                  min="7" max="90" step="1"
                  value={daysAvailable}
                  onChange={e => setDaysAvailable(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>7 days</span><span>90 days</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || (!file && syllabusText.trim().length < 50)}
              className="w-full btn-primary flex items-center justify-center space-x-2 py-3 text-base"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /><span>{loadingStep || 'Generating your plan...'}</span></>
              ) : (
                <><BookOpen className="w-5 h-5" /><span>Generate Study Plan</span></>
              )}
            </button>

            {/* Tips */}
            <div className="mt-6 bg-indigo-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-800 mb-2">💡 Tips for best results</p>
              <ul className="text-sm text-indigo-700 space-y-1">
                <li>• Include topic names, chapter titles, or subject areas</li>
                <li>• More detail = better schedule (aim for 100+ words)</li>
                <li>• Set your exam date to get a realistic timeline</li>
              </ul>
            </div>
          </Card>
        )}

        {/* ── PLAN PHASE ──────────────────────────────────────────────────── */}
        {phase === 'plan' && studyPlan && (
          <div className="animate-fade-in space-y-6">

            {/* Overview Card */}
            <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-1">Your Personalized Study Plan</h2>
                  <p className="text-indigo-100 text-sm leading-relaxed">
                    {studyPlan.overview || 'Your AI-generated study schedule is ready.'}
                  </p>
                </div>
                <div className="flex gap-4 flex-shrink-0">
                  <div className="text-center bg-white/20 rounded-xl px-4 py-3">
                    <p className="text-2xl font-black">{studyPlan.total_days || daysAvailable}</p>
                    <p className="text-xs text-indigo-200">Days</p>
                  </div>
                  <div className="text-center bg-white/20 rounded-xl px-4 py-3">
                    <p className="text-2xl font-black">{studyPlan.total_topics || totalTopics}</p>
                    <p className="text-xs text-indigo-200">Topics</p>
                  </div>
                  <div className="text-center bg-white/20 rounded-xl px-4 py-3">
                    <p className="text-2xl font-black">{overallProgress}%</p>
                    <p className="text-xs text-indigo-200">Done</p>
                  </div>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="mt-4">
                <div className="w-full bg-white/20 rounded-full h-3">
                  <div
                    className="bg-white h-3 rounded-full transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className="text-xs text-indigo-200 mt-1">
                  {completedTopics.length} of {totalTopics} topics completed
                </p>
              </div>
            </Card>

            {/* Day-by-day schedule */}
            <div className="space-y-3">
              {(studyPlan.schedule || []).map((day) => {
                const dayProgress = getDayProgress(day);
                const isExpanded = expandedDays[day.day];
                const topics = getTopicsForDay(day);
                const allDone = topics.length > 0 && topics.every(t => completedTopics.includes(t));

                return (
                  <Card key={day.day} className={`transition-all ${allDone ? 'border-l-4 border-green-500' : ''}`}>
                    {/* Day header — click to expand */}
                    <button
                      onClick={() => toggleDay(day.day)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm
                          ${allDone ? 'bg-green-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                          {allDone ? <CheckCircle className="w-5 h-5" /> : day.day}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">
                            Day {day.day} — {day.focus || 'Study Session'}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <div className="w-24 bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${dayProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{dayProgress}% done</span>
                            <span className="text-xs text-gray-400">
                              {(day.time_slots || []).length} slots
                            </span>
                          </div>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                        : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                      }
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                        {/* time_slots format (new) */}
                        {day.time_slots && day.time_slots.length > 0 && day.time_slots.map((slot, idx) => {
                          const isStudy = slot.type === 'study';
                          const isDone = isStudy && completedTopics.includes(slot.activity);
                          return (
                            <div
                              key={idx}
                              onClick={() => isStudy && toggleTopic(slot.activity)}
                              className={`flex items-center space-x-3 p-3 rounded-lg transition-all
                                ${isStudy ? 'cursor-pointer hover:bg-gray-50' : 'bg-amber-50'}
                                ${isDone ? 'bg-green-50' : ''}`}
                            >
                              <span className="text-xs font-mono text-gray-400 w-28 flex-shrink-0">{slot.time}</span>
                              {isStudy ? (
                                isDone
                                  ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                  : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                              ) : (
                                <Coffee className="w-5 h-5 text-amber-500 flex-shrink-0" />
                              )}
                              <span className={`text-sm flex-1 ${
                                isDone ? 'line-through text-gray-400' :
                                isStudy ? 'text-gray-800 font-medium' : 'text-amber-700'
                              }`}>{slot.activity}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                isStudy
                                  ? isDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isStudy ? (isDone ? 'Done ✓' : 'Study') : 'Break'}
                              </span>
                            </div>
                          );
                        })}

                        {/* Legacy topics array format */}
                        {(!day.time_slots || day.time_slots.length === 0) && day.topics && day.topics.map((topic, idx) => {
                          const isDone = completedTopics.includes(topic);
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleTopic(topic)}
                              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-50
                                ${isDone ? 'bg-green-50' : ''}`}
                            >
                              {isDone
                                ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                              }
                              <span className={`text-sm flex-1 font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {topic}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                isDone ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {isDone ? 'Done ✓' : 'Study'}
                              </span>
                            </div>
                          );
                        })}

                        {/* Day tip */}
                        {day.tips && (
                          <div className="mt-3 bg-blue-50 rounded-lg px-4 py-2.5 flex items-start space-x-2">
                            <span className="text-blue-500 text-sm">💡</span>
                            <p className="text-sm text-blue-700 italic">{day.tips}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Completion celebration */}
            {overallProgress === 100 && totalTopics > 0 && (
              <Card className="text-center py-10 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                <p className="text-5xl mb-4">🎉</p>
                <h2 className="text-3xl font-black mb-2">Study Plan Complete!</h2>
                <p className="text-green-100 text-lg">
                  You've completed all {totalTopics} topics. You're ready for your exam!
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyPlanner;
