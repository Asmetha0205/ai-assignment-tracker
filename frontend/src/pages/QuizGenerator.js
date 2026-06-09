import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { generateQuiz, submitQuizResult } from '../api/services';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import {
  Upload, FileText, ListChecks, ArrowLeft, Loader2,
  CheckCircle, History, RefreshCw, Trophy, X, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Tab constants ─────────────────────────────────────────────────────────────
const TAB_GENERATE = 'generate';
const TAB_HISTORY  = 'history';

// ── Score badge colour ────────────────────────────────────────────────────────
const scoreBadge = (pct) => {
  if (pct >= 80) return 'bg-green-100 text-green-700';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

// ── History item (expandable) ─────────────────────────────────────────────────
const HistoryItem = ({ item, index, onRetake }) => {
  const [open, setOpen] = useState(false);
  const pct = item.total_questions > 0
    ? Math.round((item.score / item.total_questions) * 100) : 0;
  const date = item.created_at_timestamp
    ? new Date(item.created_at_timestamp * 1000).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : 'Unknown date';

  return (
    <Card className="border border-gray-200">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">
              Quiz — {item.total_questions} questions
            </p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreBadge(pct)}`}>
            {item.score}/{item.total_questions} ({pct}%)
          </span>

          {item.questions?.length > 0 && (
            <button
              onClick={() => onRetake(item.questions)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /><span>Retake</span>
            </button>
          )}

          {item.questions?.length > 0 && (
            <button
              onClick={() => setOpen(o => !o)}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
              title={open ? 'Hide questions' : 'Review questions'}
            >
              {open ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable question review */}
      {open && item.questions?.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          {item.questions.map((q, qi) => (
            <div key={qi} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-800 mb-2">
                <span className="text-indigo-600 font-bold mr-1">Q{qi + 1}.</span>{q.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(q.options || []).map((opt, oi) => (
                  <div key={oi}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      opt === q.answer
                        ? 'border-green-400 bg-green-50 text-green-700 font-semibold'
                        : 'border-gray-200 text-gray-600'
                    }`}>
                    {opt === q.answer && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="text-xs text-gray-500 mt-2 italic">💡 {q.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const QuizGenerator = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB_GENERATE);

  // Generate tab state
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(null);

  // History tab state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ── Load history ────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user?.uid || historyLoaded) return;
    setHistoryLoading(true);
    try {
      const res = await axios.get(`/api/quiz/history/${user.uid}`);
      if (res.data.success) {
        setHistory(res.data.history || []);
        setHistoryLoaded(true);
      }
    } catch (e) {
      console.error('Error loading quiz history:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.uid, historyLoaded]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) loadHistory();
  }, [activeTab, loadHistory]);

  // ── File handling ───────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type === 'application/pdf') {
      setFile(f);
      toast.success('PDF selected!');
    } else {
      toast.error('Please select a PDF file');
    }
  };

  // ── Generate quiz ───────────────────────────────────────────────────────
  const handleGenerateQuiz = async () => {
    if (!file && !text.trim()) {
      toast.error('Please upload a PDF or paste some text');
      return;
    }
    setLoading(true);
    setQuiz([]); setAnswers({}); setScore(null);
    try {
      const formData = new FormData();
      formData.append('user_id', user.uid);
      formData.append('num_questions', numQuestions);
      if (text.trim()) formData.append('text', text.trim());
      if (file) formData.append('file', file);

      const response = await generateQuiz(formData);
      if (response.success) {
        setQuiz(response.quiz || []);
        toast.success('Quiz generated! Answer all questions then submit.');
      } else {
        throw new Error(response.error || 'Failed to generate quiz');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  // ── Answer selection ────────────────────────────────────────────────────
  const handleAnswerSelect = (index, option) => {
    setAnswers(prev => ({ ...prev, [index]: option }));
  };

  // ── Submit quiz ─────────────────────────────────────────────────────────
  const handleSubmitQuiz = async () => {
    if (!quiz.length) { toast.error('Please generate a quiz first'); return; }
    if (quiz.some((_, idx) => !answers[idx])) {
      toast.error('Please answer all questions before submitting');
      return;
    }
    setSubmitting(true);
    try {
      let correct = 0;
      quiz.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
      setScore({ correct, total: quiz.length });

      const response = await submitQuizResult({
        user_id: user.uid,
        user_name: user.displayName || user.email || 'Learner',
        email: user.email || '',
        score: correct,
        total_questions: quiz.length,
        questions: quiz,   // ← save full questions for history/retake
      });

      if (response.success) {
        toast.success(`Score: ${correct}/${quiz.length} · +${response.points_earned} pts`);
        // Invalidate history cache so it reloads next time
        setHistoryLoaded(false);
      } else {
        throw new Error(response.error || 'Failed to submit');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Retake: load questions from history into generate tab ───────────────
  const handleRetake = (questions) => {
    setQuiz(questions);
    setAnswers({});
    setScore(null);
    setActiveTab(TAB_GENERATE);
    toast.success('Quiz loaded — answer and submit to retake!');
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setQuiz([]); setAnswers({}); setScore(null);
    setFile(null); setText('');
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Back */}
        <button onClick={() => navigate('/dashboard')}
          className="mb-4 flex items-center space-x-2 text-white hover:text-indigo-200 transition-all">
          <ArrowLeft className="w-5 h-5" /><span className="font-medium">Back to Dashboard</span>
        </button>

        <div className="mb-6 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-2">🧠 AI Quiz Generator</h1>
          <p className="text-white/80 text-lg">Generate quizzes from your study materials and climb the leaderboard!</p>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex space-x-2 mb-6">
          {[
            { id: TAB_GENERATE, label: 'Generate Quiz', icon: ListChecks },
            { id: TAB_HISTORY,  label: 'Quiz History',  icon: History },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeTab === id
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}>
              <Icon className="w-4 h-4" /><span>{label}</span>
              {id === TAB_HISTORY && history.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {history.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── GENERATE TAB ─────────────────────────────────────────────── */}
        {activeTab === TAB_GENERATE && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input panel */}
            <div className="lg:col-span-1 animate-slide-up space-y-6">
              <Card>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                  <Upload className="w-6 h-6 mr-2 text-indigo-600" />
                  Upload Material
                </h2>

                {/* PDF upload */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:border-indigo-500 transition-all cursor-pointer">
                    <input type="file" accept=".pdf" onChange={handleFileChange}
                      className="hidden" id="quiz-file-upload" />
                    <label htmlFor="quiz-file-upload" className="cursor-pointer">
                      {file ? (
                        <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-indigo-700 truncate">{file.name}</span>
                          <button onClick={(e) => { e.preventDefault(); setFile(null); }}
                            className="ml-2 text-indigo-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-600 text-sm">Click to upload PDF</p>
                          <p className="text-xs text-gray-400 mt-1">PDF up to 10MB</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="text-center text-gray-400 text-sm my-3">OR</div>

                {/* Text input */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paste Text</label>
                  <textarea value={text} onChange={e => setText(e.target.value)}
                    disabled={!!file}
                    className="input-field min-h-[130px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Paste your notes or summary here..." />
                </div>

                {/* Num questions */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
                  <input type="number" min="5" max="15" value={numQuestions}
                    onChange={e => setNumQuestions(e.target.value)} className="input-field" />
                </div>

                <button onClick={handleGenerateQuiz} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center space-x-2">
                  {loading
                    ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Generating...</span></>
                    : <><ListChecks className="w-5 h-5" /><span>Generate Quiz</span></>
                  }
                </button>
              </Card>
            </div>

            {/* Quiz panel */}
            <div className="lg:col-span-2 animate-slide-up">
              <Card className="min-h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-indigo-600" />
                    Quiz
                  </h2>
                  {quiz.length > 0 && !score && (
                    <button onClick={handleReset}
                      className="text-sm text-gray-400 hover:text-red-500 flex items-center space-x-1 transition-all">
                      <X className="w-4 h-4" /><span>Clear</span>
                    </button>
                  )}
                </div>

                {!quiz.length ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                    <ListChecks className="w-16 h-16 text-gray-300 mb-4" />
                    <p>Generate a quiz to start practicing.</p>
                    <p className="text-sm mt-1 text-gray-400">Or check History to retake a past quiz.</p>
                  </div>
                ) : (
                  <>
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{Object.keys(answers).length} of {quiz.length} answered</span>
                        {score && <span className="font-semibold text-indigo-600">
                          Score: {score.correct}/{score.total} ({Math.round(score.correct/score.total*100)}%)
                        </span>}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${(Object.keys(answers).length / quiz.length) * 100}%` }} />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      {quiz.map((question, index) => (
                        <Card key={index} className="border border-gray-200">
                          <div className="flex items-start space-x-3 mb-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-sm">
                              {index + 1}
                            </div>
                            <p className="text-gray-800 font-medium">{question.question}</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {question.options.map((option, oi) => {
                              const isSelected = answers[index] === option;
                              const isCorrect  = score && question.answer === option;
                              const isWrong    = score && isSelected && !isCorrect;
                              return (
                                <button key={oi}
                                  onClick={() => handleAnswerSelect(index, option)}
                                  disabled={!!score}
                                  className={`p-3 rounded-lg border text-left text-sm transition-all
                                    ${isCorrect ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : ''}
                                    ${isWrong   ? 'border-red-500 bg-red-50 text-red-700' : ''}
                                    ${isSelected && !score ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : ''}
                                    ${!isSelected && !isCorrect && !isWrong ? 'border-gray-200 hover:border-indigo-300 text-gray-700' : ''}
                                  `}>
                                  {isCorrect && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                          {score && (
                            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                              ✅ <strong>Answer:</strong> {question.answer}
                              {question.explanation && ` — ${question.explanation}`}
                            </p>
                          )}
                        </Card>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
                      {score ? (
                        <div className="flex items-center space-x-3">
                          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                            scoreBadge(Math.round(score.correct / score.total * 100))}`}>
                            <Trophy className="w-4 h-4 inline mr-1" />
                            {score.correct}/{score.total} ({Math.round(score.correct/score.total*100)}%)
                          </div>
                          <button onClick={handleReset}
                            className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all">
                            <RefreshCw className="w-4 h-4" /><span>New Quiz</span>
                          </button>
                        </div>
                      ) : <div />}

                      <button onClick={handleSubmitQuiz} disabled={submitting || !!score}
                        className="btn-primary px-6 flex items-center space-x-2">
                        {submitting
                          ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Submitting...</span></>
                          : <><CheckCircle className="w-5 h-5" /><span>Submit Quiz</span></>
                        }
                      </button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────────────────── */}
        {activeTab === TAB_HISTORY && (
          <div className="animate-fade-in">
            {historyLoading ? (
              <div className="flex items-center justify-center py-20 text-white">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                <span>Loading quiz history...</span>
              </div>
            ) : history.length === 0 ? (
              <Card className="text-center py-16">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-600 mb-2">No quiz history yet</h3>
                <p className="text-gray-500 mb-6">Complete a quiz to see your history here</p>
                <button onClick={() => setActiveTab(TAB_GENERATE)}
                  className="btn-primary mx-auto flex items-center space-x-2 px-6">
                  <ListChecks className="w-5 h-5" /><span>Take a Quiz</span>
                </button>
              </Card>
            ) : (
              <>
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">{history.length}</p>
                      <p className="text-sm text-gray-500">Quizzes Taken</p>
                    </div>
                  </Card>
                  <Card>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {history.reduce((s, h) => s + h.score, 0)}
                      </p>
                      <p className="text-sm text-gray-500">Total Correct</p>
                    </div>
                  </Card>
                  <Card>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {history.length > 0
                          ? Math.round(history.reduce((s, h) =>
                              s + (h.total_questions > 0 ? h.score / h.total_questions * 100 : 0), 0
                            ) / history.length)
                          : 0}%
                      </p>
                      <p className="text-sm text-gray-500">Avg Score</p>
                    </div>
                  </Card>
                </div>

                {/* History list */}
                <div className="space-y-3">
                  {history.map((item, i) => (
                    <HistoryItem key={item.id || i} item={item} index={i} onRetake={handleRetake} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default QuizGenerator;
