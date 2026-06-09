import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import toast from 'react-hot-toast';
import { 
  Home, 
  BookOpen,
  Timer,
  FileText, 
  Bot, 
  TrendingUp, 
  Trophy, 
  LogOut, 
  Menu, 
  X,
  ListChecks,
  UserCircle,
  Layers,
  CalendarDays,
  ChevronDown,
  Grid3X3
} from 'lucide-react';

const Navbar = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully!');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  // Primary navigation (always visible)
  const primaryLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/study-plan', icon: BookOpen, label: 'Study Plan' },
    { to: '/progress', icon: TrendingUp, label: 'Progress' },
  ];

  // Tools dropdown (grouped)
  const toolsLinks = [
    { to: '/summarizer', icon: FileText, label: 'Notes Summarizer' },
    { to: '/assistant', icon: Bot, label: 'AI Assistant' },
    { to: '/quiz', icon: ListChecks, label: 'Quiz Generator' },
    { to: '/pomodoro', icon: Timer, label: 'Pomodoro Timer' },
    { to: '/flashcards', icon: Layers, label: 'Flashcards' },
    { to: '/exams', icon: CalendarDays, label: 'Exam Countdown' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800 hidden sm:block">
              AI Study Planner
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            
            {/* Primary Links */}
            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isActive(link.to)
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <link.icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}

            {/* Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  toolsLinks.some(link => isActive(link.to))
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
                <span className="font-medium">Tools</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showToolsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showToolsDropdown && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  {toolsLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setShowToolsDropdown(false)}
                      className={`flex items-center space-x-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
                        isActive(link.to) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      <link.icon className="w-4 h-4" />
                      <span className="text-sm">{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Section */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50">
              <UserCircle className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-800 max-w-[120px] truncate">
                {user?.displayName || 'User'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-3 space-y-1">
            
            {/* Primary Links */}
            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                  isActive(link.to)
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setIsOpen(false)}
              >
                <link.icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}

            {/* Tools Section */}
            <div className="pt-2 mt-2 border-t border-gray-100">
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Study Tools
              </p>
              {toolsLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                    isActive(link.to)
                      ? 'bg-indigo-100 text-indigo-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <link.icon className="w-5 h-5" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
            
            {/* User Section */}
            <div className="pt-3 mt-3 border-t border-gray-200">
              <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-50 mb-2">
                <UserCircle className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">{user?.displayName || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {showToolsDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowToolsDropdown(false)}
        />
      )}
    </nav>
  );
};

export default Navbar;
