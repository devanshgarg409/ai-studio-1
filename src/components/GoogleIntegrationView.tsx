import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { GoogleAuthStatus, SyncedCalendarEvent, User } from '../types';
import { 
  Calendar, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Unlink, 
  Clock, 
  ShieldCheck, 
  FileCode, 
  ExternalLink,
  Info,
  CalendarCheck,
  Sparkles
} from 'lucide-react';

interface Props {
  currentUser: User;
  onStatusChange?: () => void;
}

export const GoogleIntegrationView: React.FC<Props> = ({ currentUser, onStatusChange }) => {
  const [status, setStatus] = useState<GoogleAuthStatus | null>(null);
  const [events, setEvents] = useState<SyncedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getGoogleStatus();
      setStatus(res.status);
      if (res.status.isAuthorized) {
        const evts = await api.getGoogleEvents();
        setEvents(evts);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      console.error('Error fetching Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [currentUser.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        setUploading(true);
        const res = await api.uploadGoogleConfig(content);
        setMessage({ type: 'success', text: res.message });
        await fetchStatus();
        onStatusChange?.();
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to upload JSON credentials' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleJsonSubmit = async () => {
    if (!jsonInput.trim()) return;
    try {
      setUploading(true);
      const res = await api.uploadGoogleConfig(jsonInput);
      setMessage({ type: 'success', text: res.message });
      setShowJsonEditor(false);
      setJsonInput('');
      await fetchStatus();
      onStatusChange?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Invalid JSON format or missing keys' });
    } finally {
      setUploading(false);
    }
  };

  const loadDemoTemplate = () => {
    const template = {
      installed: {
        client_id: `demo-${currentUser.id}.apps.googleusercontent.com`,
        project_id: "academiasync-demo-cloud",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_secret: "GOCSPX-demoSecretKeyForUserSandbox",
        redirect_uris: ["http://localhost", "https://localhost"]
      }
    };
    setJsonInput(JSON.stringify(template, null, 2));
    setShowJsonEditor(true);
  };

  const handleConnectOAuth = async () => {
    try {
      const authUrl = await api.getGoogleAuthUrl();
      // Avoid window.alert or window.open in strict sandbox; redirect or open popup cleanly
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        authUrl, 
        'GoogleAuthorization', 
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
      );

      // Listen for message from popup
      const messageHandler = (e: MessageEvent) => {
        if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          setMessage({ type: 'success', text: 'Google Account successfully authorized!' });
          fetchStatus();
          onStatusChange?.();
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate OAuth URL' });
    }
  };

  const handleSimulateAuth = async () => {
    try {
      setSyncing(true);
      const res = await api.simulateGoogleAuth();
      setMessage({ type: 'success', text: `${res.message} (Connected as ${res.googleEmail})` });
      await fetchStatus();
      onStatusChange?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to authorize sandbox' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const res = await api.syncGoogleCalendar();
      setMessage({ type: 'success', text: `Synced ${res.count} events from Google Calendar.` });
      await fetchStatus();
      onStatusChange?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Calendar sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectGoogle();
      setMessage({ type: 'info', text: 'Google credentials and calendar sync disconnected.' });
      await fetchStatus();
      onStatusChange?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Disconnect failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">Google Account Integration</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/30 text-blue-100 border border-blue-400/20">
                  Per-User OAuth Isolated
                </span>
              </div>
              <p className="text-blue-100/90 text-sm mt-1 max-w-2xl">
                Connect your individual student or faculty Google Calendar. All appointments booked through AcademiaSync automatically sync to your calendar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs text-blue-100 flex items-center gap-2 border border-white/10">
              <Clock className="w-4 h-4 text-emerald-300" />
              <span>Periodic sync runs <b>every 30 mins</b></span>
            </div>
          </div>
        </div>

        {/* Security & Scoping Notice */}
        <div className="mt-4 pt-4 border-t border-white/15 flex items-start gap-2.5 text-xs text-blue-100/80">
          <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
          <span>
            <strong>Strict Identity Isolation:</strong> Uploaded credentials and OAuth tokens are strictly bound to user 
            <span className="text-white font-mono ml-1 mr-1 px-1.5 py-0.5 bg-white/10 rounded">{currentUser.displayName} ({currentUser.id})</span>.
            Students and faculty can never access another user's tokens or calendar data.
          </span>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : message.type === 'error' 
            ? 'bg-rose-50 text-rose-900 border border-rose-200' 
            : 'bg-blue-50 text-blue-900 border border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Main Grid: Upload / Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload & Credentials Config */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-600" />
              1. Upload Google Credentials
            </h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Upload the OAuth Client JSON file generated from Google Cloud Console (<code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">client_secret_xxx.json</code>).
            It contains your application client ID and client secret.
          </p>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors rounded-xl p-6 text-center bg-slate-50/50">
            <input 
              type="file" 
              accept=".json,application/json" 
              onChange={handleFileUpload} 
              id="google-creds-upload" 
              className="hidden" 
              disabled={uploading}
            />
            <label htmlFor="google-creds-upload" className="cursor-pointer block">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                {uploading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <span className="text-sm font-medium text-slate-800 block">Choose Google JSON File</span>
              <span className="text-xs text-slate-500 mt-1 block">Supports <code className="text-slate-700">installed</code> or <code className="text-slate-700">web</code> JSON</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowJsonEditor(!showJsonEditor)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {showJsonEditor ? 'Hide JSON Editor' : 'Paste Raw JSON'}
            </button>
            <button
              onClick={loadDemoTemplate}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Use Sample Config
            </button>
          </div>

          {showJsonEditor && (
            <div className="space-y-3 pt-2">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"installed": {"client_id": "...", "client_secret": "..."}}'
                className="w-full h-32 text-xs font-mono p-2.5 bg-slate-900 text-emerald-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handleJsonSubmit}
                disabled={uploading || !jsonInput.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Save JSON Credentials
              </button>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> The credentials file defines the OAuth client. Your actual user authorization happens next when you connect your personal Google Account.
            </span>
          </div>
        </div>

        {/* Right Column: Connection Status & Actions */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              2. Connection Status & Account Authorization
            </h3>
            <button 
              onClick={fetchStatus}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Status Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Credentials Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-xs font-medium text-slate-500 block mb-1">OAuth Client Credentials</span>
              <div className="flex items-center gap-2">
                {status?.hasCredentials ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">Configured</span>
                      <span className="text-xs font-mono text-slate-500 block truncate max-w-[200px]">
                        {status.clientIdMasked}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-slate-700">Not Uploaded</span>
                      <span className="text-xs text-slate-500 block">Upload credentials JSON first</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Account Authorization Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
              <span className="text-xs font-medium text-slate-500 block mb-1">Google Account Authorization</span>
              <div className="flex items-center gap-2">
                {status?.isAuthorized ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-emerald-700">Connected & Active</span>
                      <span className="text-xs font-medium text-slate-600 block truncate max-w-[200px]">
                        {status.googleEmail || currentUser.email}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-slate-700">Not Connected</span>
                      <span className="text-xs text-slate-500 block">Requires user authorization</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {status?.isAuthorized ? (
              <>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing Calendar...' : 'Sync Calendar Now'}
                </button>

                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect Credentials
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleConnectOAuth}
                  disabled={!status?.hasCredentials}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Authorize Google Account (OAuth)
                </button>

                <button
                  onClick={handleSimulateAuth}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Quick Sandbox Authorization
                </button>
              </>
            )}
          </div>

          {/* Synced Calendar Events Section */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Synced Google Calendar Events ({events.length})
              </h4>
              {status?.lastSyncedAt && (
                <span className="text-xs text-slate-500">
                  Last synced: {new Date(status.lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {events.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">No synced calendar events</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {status?.isAuthorized 
                    ? 'Click "Sync Calendar Now" to fetch your Google Calendar events.' 
                    : 'Authorize your Google Account above to sync upcoming events and appointments.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {events.map((evt) => (
                  <div 
                    key={evt.id} 
                    className="p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{evt.summary}</span>
                        {evt.isAppointment && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-medium rounded-full text-[10px]">
                            AcademiaSync
                          </span>
                        )}
                      </div>
                      {evt.description && (
                        <p className="text-slate-500 mt-1 line-clamp-1">{evt.description}</p>
                      )}
                      {evt.location && (
                        <p className="text-slate-400 mt-0.5">{evt.location}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-medium text-slate-700 block">
                        {new Date(evt.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-slate-500">
                        {new Date(evt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
