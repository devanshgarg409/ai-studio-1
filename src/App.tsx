import React, { useState, useEffect } from 'react';
import { api } from './api';
import { User } from './types';
import { testConnection } from './firebase';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { StudentDashboard } from './components/StudentDashboard';
import { FacultyDashboard } from './components/FacultyDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { GoogleIntegrationView } from './components/GoogleIntegrationView';
import { AIChatModal } from './components/AIChatModal';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'google-integration' | 'ai-chat'>('dashboard');
  const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
  
  // Modals
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // App initialization
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        // Test Firestore connection as required by Firebase skill
        await testConnection();

        // Check if user session already exists
        const savedUserId = api.getUserId();
        if (savedUserId) {
          try {
            const user = await api.getCurrentUser();
            setCurrentUser(user);
            const gRes = await api.getGoogleStatus();
            setIsGoogleAuthorized(gRes.status.isAuthorized);
          } catch {
            // Session expired or invalid, clear
            api.logout();
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to initialize app state:', err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const refreshGoogleStatus = async () => {
    if (!currentUser) return;
    try {
      const gRes = await api.getGoogleStatus();
      setIsGoogleAuthorized(gRes.status.isAuthorized);
    } catch (err) {
      console.error('Error refreshing Google status:', err);
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    setActiveView('dashboard');
    try {
      const gRes = await api.getGoogleStatus();
      setIsGoogleAuthorized(gRes.status.isAuthorized);
    } catch {
      setIsGoogleAuthorized(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setIsGoogleAuthorized(false);
    setActiveView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-white font-bold text-lg">Initializing AcademiaSync...</h2>
          <p className="text-xs text-slate-400">Verifying secure services and database connection</p>
        </div>
      </div>
    );
  }

  // Requirement 1: Application must open with a Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const roleUpper = (currentUser.role || '').toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        onLogout={handleLogout}
        isGoogleAuthorized={isGoogleAuthorized}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'google-integration' ? (
          <GoogleIntegrationView
            currentUser={currentUser}
            onStatusChange={refreshGoogleStatus}
          />
        ) : (
          <>
            {roleUpper === 'STUDENT' && (
              <StudentDashboard
                currentUser={currentUser}
                onOpenAIChat={() => setIsAIChatOpen(true)}
                onOpenGoogleIntegration={() => setActiveView('google-integration')}
              />
            )}

            {roleUpper === 'FACULTY' && (
              <FacultyDashboard
                currentUser={currentUser}
                onOpenAIChat={() => setIsAIChatOpen(true)}
                onOpenGoogleIntegration={() => setActiveView('google-integration')}
              />
            )}

            {roleUpper === 'ADMIN' && (
              <AdminDashboard
                currentUser={currentUser}
                onOpenAIChat={() => setIsAIChatOpen(true)}
                onOpenGoogleIntegration={() => setActiveView('google-integration')}
              />
            )}
          </>
        )}
      </main>

      {/* Floating AI Assistant Trigger */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <button
          onClick={() => setIsAIChatOpen(true)}
          className="p-4 bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl shadow-xl shadow-purple-600/30 transition-all transform hover:scale-105 flex items-center gap-2.5 font-semibold text-sm group"
          title="Open AI Appointment Assistant"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300">
            Ask AcademiaSync AI
          </span>
        </button>
      </div>

      {/* AI Assistant Chat Modal */}
      <AIChatModal
        currentUser={currentUser}
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onAppointmentChanged={() => {
          // Trigger refresh
        }}
      />
    </div>
  );
}
