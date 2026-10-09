import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Appointment, FacultyProfile, User, SyncedCalendarEvent } from '../types';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserCheck, 
  Building2, 
  Sparkles, 
  CalendarDays,
  Save,
  Check,
  CalendarSync,
  AlertTriangle,
  Mail,
  User as UserIcon,
  ShieldCheck,
  FileText,
  RefreshCw
} from 'lucide-react';

interface Props {
  currentUser: User;
  onOpenAIChat: () => void;
  onOpenGoogleIntegration: () => void;
}

export const FacultyDashboard: React.FC<Props> = ({ currentUser, onOpenAIChat, onOpenGoogleIntegration }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [googleEvents, setGoogleEvents] = useState<SyncedCalendarEvent[]>([]);
  const [facultyProfile, setFacultyProfile] = useState<FacultyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'schedule' | 'profile'>('requests');

  // Reject modal
  const [rejectingAptId, setRejectingAptId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel modal
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Profile Edit State (NO manual free/occupied slots as per Requirement 3)
  const [titleText, setTitleText] = useState('');
  const [officeLocationText, setOfficeLocationText] = useState('');
  const [bioText, setBioText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [apts, allFac] = await Promise.all([
        api.getAppointments(),
        api.getFacultyList()
      ]);
      setAppointments(apts);

      const profile = allFac.find(f => f.userId === currentUser.id) || allFac.find(f => f.username === currentUser.username);
      if (profile) {
        setFacultyProfile(profile);
        setTitleText(profile.title || '');
        setOfficeLocationText(profile.officeLocation || '');
        setBioText(profile.bio || '');

        if (profile.isGoogleConnected) {
          try {
            const evts = await api.getGoogleEvents();
            setGoogleEvents(evts);
          } catch {
            setGoogleEvents([]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading faculty dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await api.syncGoogleCalendar();
      setSyncMessage(`Two-Way Sync Complete: ${res.count} calendar events synchronized with Google Calendar.`);
      await loadData();
      setTimeout(() => setSyncMessage(null), 3500);
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      setSyncing(true);
      await api.updateAppointmentStatus(id, 'accepted');
      setSyncMessage('Appointment confirmed and booked to your Google Calendar!');
      await loadData();
      setTimeout(() => setSyncMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to accept appointment:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingAptId) return;
    try {
      setSyncing(true);
      await api.updateAppointmentStatus(rejectingAptId, 'rejected', rejectReason);
      setRejectingAptId(null);
      setRejectReason('');
      setSyncMessage('Appointment rejected and freed from Google Calendar.');
      await loadData();
      setTimeout(() => setSyncMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to reject appointment:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellingAptId) return;
    try {
      setSyncing(true);
      await api.updateAppointmentStatus(cancellingAptId, 'cancelled', cancelReason || 'Cancelled by faculty member');
      setCancellingAptId(null);
      setCancelReason('');
      setSyncMessage('Appointment cancelled and removed from Google Calendar.');
      await loadData();
      setTimeout(() => setSyncMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to cancel appointment:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyProfile) return;
    try {
      setSaveError(null);
      await api.updateAdminFaculty(facultyProfile.id, {
        title: titleText,
        officeLocation: officeLocationText,
        bio: bioText
      });
      setSaveSuccess(true);
      await loadData();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save profile');
    }
  };

  const pendingRequests = appointments.filter(a => a.status === 'pending');
  const confirmedUpcoming = appointments.filter(a => a.status === 'accepted');
  const pastOrInactive = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Faculty Portal: {currentUser.displayName}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              {facultyProfile?.title || 'Faculty Member'}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Department of {currentUser.department || 'Academic Department'} • Official Working Hours: <strong>9:00 AM – 4:00 PM</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {facultyProfile?.isGoogleConnected && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-50"
              title="Force two-way synchronization with Google Calendar"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing Calendar...' : 'Two-Way Sync Now'}
            </button>
          )}

          <button
            onClick={onOpenGoogleIntegration}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 ${
              facultyProfile?.isGoogleConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <CalendarSync className="w-4 h-4" />
            {facultyProfile?.isGoogleConnected ? 'Google Calendar Connected' : 'Connect Google Calendar'}
          </button>

          <button
            onClick={onOpenAIChat}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            AI Assistant
          </button>
        </div>
      </div>

      {/* Two-Way Sync Notification Alert */}
      {syncMessage && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl p-4 text-xs font-medium flex items-center gap-2.5 shadow-xs transition-all animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Google Calendar Connection Status Notice (Requirement 3 & 4) */}
      {!facultyProfile?.isGoogleConnected ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Google Calendar is Not Linked</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Students cannot book appointments with you until your Google Calendar is connected. Working hours are 9:00 AM – 4:00 PM, and your Google Calendar is the sole source of truth for your availability.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenGoogleIntegration}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
          >
            Link Google Account Now
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 text-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Google Calendar Connected:</strong> Your student availability is synchronized live between 9:00 AM and 4:00 PM.
            </span>
          </div>
          <button
            onClick={onOpenGoogleIntegration}
            className="text-emerald-700 hover:text-emerald-900 font-bold underline"
          >
            Manage Integration
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'requests'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Pending Requests ({pendingRequests.length})
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Confirmed Schedule ({confirmedUpcoming.length})
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
            activeTab === 'profile'
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Faculty Details
        </button>
      </div>

      {/* TAB 1: PENDING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Student Appointment Requests</h3>
              <p className="text-xs text-slate-500">Review student details and accept or reject appointment proposals</p>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-700">All Caught Up!</h4>
              <p className="text-xs text-slate-400 mt-1">There are no pending student appointment requests at this moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRequests.map((apt) => (
                <div key={apt.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        Pending Confirmation
                      </span>
                      <span className="text-xs text-slate-400">Requested {new Date(apt.createdAt).toLocaleDateString()}</span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{apt.purpose}</h4>

                    {/* Student Information View */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Student: <strong>{apt.studentName}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{apt.studentEmail}</span>
                      </div>
                      {apt.notes && (
                        <div className="flex items-start gap-2 pt-1 border-t border-slate-200 text-slate-500">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>Student Notes: "{apt.notes}"</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 pt-1">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        {apt.date}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        {apt.startTime} - {apt.endTime} (Working hours: 9:00 AM – 4:00 PM)
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(apt.id)}
                      className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Accept & Sync Calendar
                    </button>

                    <button
                      onClick={() => setRejectingAptId(apt.id)}
                      className="w-full px-5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONFIRMED SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Upcoming Confirmed Appointments</h3>
              <p className="text-xs text-slate-500">All confirmed appointments automatically sync to your personal Google Calendar</p>
            </div>
          </div>

          {confirmedUpcoming.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Confirmed Appointments Yet</h4>
              <p className="text-xs text-slate-400 mt-1">Confirmed student appointments will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Purpose</th>
                    <th className="py-3 px-3">Google Calendar</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {confirmedUpcoming.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{apt.studentName}</span>
                        <span className="text-[11px] text-slate-400">{apt.studentEmail}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <span className="font-semibold block">{apt.date}</span>
                        <span className="text-[11px] text-slate-500">{apt.startTime} - {apt.endTime}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{apt.purpose}</td>
                      <td className="py-3 px-3">
                        {apt.googleCalendarEventId ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Synced
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setCancellingAptId(apt.id)}
                          className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Two-Way Google Calendar Synced Events Section */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarSync className="w-4 h-4 text-indigo-600" />
                  Google Calendar Bookings & Events (Source of Truth)
                </h4>
                <p className="text-xs text-slate-500">
                  Any event on your Google Calendar automatically blocks appointment slots between 9:00 AM – 4:00 PM.
                </p>
              </div>
              {facultyProfile?.isGoogleConnected && (
                <button
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
                  {syncing ? 'Syncing...' : 'Refresh Calendar'}
                </button>
              )}
            </div>

            {googleEvents.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                {facultyProfile?.isGoogleConnected
                  ? 'No external Google Calendar busy events found. All working hours (9:00 AM – 4:00 PM) remain open for booking.'
                  : 'Link your Google Calendar to synchronize busy slots and appointments automatically.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {googleEvents.slice(0, 8).map((evt) => (
                  <div key={evt.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{evt.summary}</div>
                      <div className="text-slate-500 flex items-center gap-2 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          {evt.start.includes('T') ? evt.start.replace('T', ' ').substring(0, 16) : evt.start} — {evt.end.includes('T') ? evt.end.replace('T', ' ').substring(11, 16) : evt.end}
                        </span>
                      </div>
                      {evt.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{evt.description}</div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                      Blocks Slot
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pastOrInactive.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Appointment History</h4>
              <div className="text-xs text-slate-400">
                {pastOrInactive.length} previous sessions (completed, cancelled, or rejected).
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FACULTY DETAILS */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6 max-w-2xl">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Faculty Details & Office Information</h3>
            <p className="text-xs text-slate-500">
              Update your academic title, office location, and bio for students viewing your profile.
            </p>
          </div>

          {/* Working Hours Policy Box (Requirement 3) */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-950">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Institutional Working Hours: 9:00 AM – 4:00 PM</span>
            </div>
            <p className="text-indigo-800/80">
              As per institution requirements, individual availability is strictly determined by your connected Google Calendar. The application does not maintain manually entered free/occupied slots.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Faculty profile details saved successfully!</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Academic Title
              </label>
              <input
                type="text"
                value={titleText}
                onChange={(e) => setTitleText(e.target.value)}
                placeholder="e.g. Associate Professor of Computer Science"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Office Location
              </label>
              <input
                type="text"
                value={officeLocationText}
                onChange={(e) => setOfficeLocationText(e.target.value)}
                placeholder="e.g. Turing Hall, Room 402"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Biography / Student Advising Topics
              </label>
              <textarea
                rows={3}
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Brief bio, research areas, and guidance topics for student advising..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Details
            </button>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingAptId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Reject Appointment Request</h3>
            <p className="text-xs text-slate-500">Provide an optional note to explain why this slot cannot be accommodated.</p>
            <textarea
              rows={2}
              placeholder="Reason for declining..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRejectingAptId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingAptId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Cancel Appointment?</h3>
            <p className="text-xs text-slate-500">The session will be cancelled and removed from your Google Calendar.</p>
            <textarea
              rows={2}
              placeholder="Cancellation note..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setCancellingAptId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
