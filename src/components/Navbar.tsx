import React from 'react';
import { User } from '../types';
import { 
  Calendar, 
  Sparkles, 
  CalendarSync, 
  Shield, 
  GraduationCap, 
  School,
  LogOut,
  User as UserIcon
} from 'lucide-react';

interface Props {
  currentUser: User;
  activeView: 'dashboard' | 'google-integration' | 'ai-chat';
  onNavigate: (view: 'dashboard' | 'google-integration' | 'ai-chat') => void;
  onOpenAIChat: () => void;
  onLogout: () => void;
  isGoogleAuthorized: boolean;
}

export const Navbar: React.FC<Props> = ({
  currentUser,
  activeView,
  onNavigate,
  onOpenAIChat,
  onLogout,
  isGoogleAuthorized
}) => {
  const roleUpper = (currentUser.role || '').toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">AcademiaSync</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  AI System
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block -mt-1 font-medium">Student-Faculty Appointment Platform</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                activeView === 'dashboard'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onNavigate('google-integration')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeView === 'google-integration'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CalendarSync className="w-3.5 h-3.5" />
              Google Calendar
              {isGoogleAuthorized && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="Google Calendar Connected" />
              )}
            </button>
          </nav>
        </div>

        {/* Right side: AI Assistant + User profile chip + Logout */}
        <div className="flex items-center gap-2.5">
          {/* AI Assistant Button */}
          <button
            onClick={onOpenAIChat}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          {/* User Profile Info Chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase">
              {currentUser.displayName ? currentUser.displayName[0] : 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <span className="text-xs font-bold text-slate-800 block leading-tight">{currentUser.displayName}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">ID: {currentUser.username}</span>
                {roleUpper === 'ADMIN' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> ADMIN
                  </span>
                )}
                {roleUpper === 'FACULTY' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 flex items-center gap-0.5">
                    <GraduationCap className="w-2.5 h-2.5" /> FACULTY
                  </span>
                )}
                {roleUpper === 'STUDENT' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 flex items-center gap-0.5">
                    <School className="w-2.5 h-2.5" /> STUDENT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
