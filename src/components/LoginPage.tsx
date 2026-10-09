import React, { useState } from 'react';
import { api } from '../api';
import { User } from '../types';
import { Lock, UserCheck, Shield, AlertCircle, ArrowRight, Calendar, KeyRound, Sparkles } from 'lucide-react';

interface Props {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both User ID and Password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await api.login(username.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillAdmin = () => {
    setUsername('admin');
    setPassword('admin');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/25 mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">AcademiaSync</h1>
        <p className="text-indigo-200/80 text-sm mt-1.5">
          AI-Powered Student-Faculty Appointment & Calendar System
        </p>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Sign In to Your Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access your academic dashboard, appointment scheduling, and calendar
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              User ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or assigned student/faculty ID"
                required
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 transition-all text-slate-800"
              />
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 transition-all text-slate-800"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Initial Setup Credentials Notice */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Initial Setup Account
              </span>
              <button
                type="button"
                onClick={handleQuickFillAdmin}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                Auto-fill
              </button>
            </div>
            <div className="space-y-1 text-xs text-slate-600 font-mono bg-white p-2.5 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-400">User ID:</span>
                <strong className="text-slate-800">admin</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Password:</span>
                <strong className="text-slate-800">admin</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <strong className="text-indigo-600">ADMIN</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              No Student or Faculty profile exists initially. Log in as <strong>ADMIN</strong> to create Student and Faculty profiles.
            </p>
          </div>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="mt-6 text-center text-xs text-slate-400 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>Secured with cryptographic hashing & Google Calendar OAuth</span>
      </div>
    </div>
  );
};
