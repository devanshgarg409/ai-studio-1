import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Appointment, FacultyProfile, User, TimeSlot, FacultyAvailabilityResponse } from '../types';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Building2, 
  Sparkles, 
  CalendarDays,
  Send,
  AlertTriangle,
  Check,
  Search,
  UserCheck,
  CalendarCheck2
} from 'lucide-react';

interface Props {
  currentUser: User;
  onOpenAIChat: () => void;
  onOpenGoogleIntegration: () => void;
}

export const StudentDashboard: React.FC<Props> = ({ currentUser, onOpenAIChat, onOpenGoogleIntegration }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'book' | 'my-appointments'>('overview');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Booking Form State
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingPurpose, setBookingPurpose] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Faculty Google Calendar Availability State
  const [availability, setAvailability] = useState<FacultyAvailabilityResponse | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Cancel Modal State
  const [cancellingAptId, setCancellingAptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [apts, facs] = await Promise.all([
        api.getAppointments(),
        api.getFacultyList()
      ]);
      setAppointments(apts);
      setFacultyList(facs);
      if (facs.length > 0 && !selectedFacultyId) {
        setSelectedFacultyId(facs[0].id);
      }
      if (!bookingDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setBookingDate(tomorrow.toISOString().split('T')[0]);
      }
    } catch (err: any) {
      console.error('Error loading student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  // When faculty or date changes, check Google Calendar availability (Requirements 3, 4, 6)
  useEffect(() => {
    if (!selectedFacultyId || !bookingDate) return;

    const checkAvail = async () => {
      try {
        setCheckingAvailability(true);
        setSelectedSlot(null);
        const res = await api.getFacultyAvailability(selectedFacultyId, bookingDate);
        setAvailability(res);
      } catch (err: any) {
        console.error('Failed to get faculty availability:', err);
        setAvailability({
          facultyId: selectedFacultyId,
          facultyName: '',
          date: bookingDate,
          isConnected: false,
          message: 'Google Account Not Linked. Kindly contact the faculty personally to schedule an appointment.',
          workingHours: '9:00 AM – 4:00 PM',
          slots: []
        });
      } finally {
        setCheckingAvailability(false);
      }
    };

    checkAvail();
  }, [selectedFacultyId, bookingDate]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId || !bookingDate || !selectedSlot || !bookingPurpose) {
      setBookingError('Please select a faculty member, date, available time slot, and specify your purpose.');
      return;
    }

    if (!availability?.isConnected) {
      setBookingError('Cannot book appointment: Faculty Google Calendar is not linked.');
      return;
    }

    try {
      setBookingLoading(true);
      setBookingError(null);
      await api.createAppointment({
        facultyId: selectedFacultyId,
        date: bookingDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        purpose: bookingPurpose.trim(),
        notes: bookingNotes.trim()
      });

      setBookingSuccess('Appointment request submitted successfully! Synced with faculty Google Calendar.');
      setBookingPurpose('');
      setBookingNotes('');
      setSelectedSlot(null);
      await loadData();
      setTimeout(() => {
        setBookingSuccess(null);
        setActiveTab('my-appointments');
      }, 1500);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancellingAptId) return;
    try {
      await api.updateAppointmentStatus(cancellingAptId, 'cancelled', cancelReason);
      setCancellingAptId(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      console.error('Failed to cancel appointment:', err);
    }
  };

  const selectedFaculty = facultyList.find(f => f.id === selectedFacultyId);

  // Metrics
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const acceptedCount = appointments.filter(a => a.status === 'accepted').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const nextAppointment = appointments
    .filter(a => a.status === 'accepted' && new Date(`${a.date}T${a.startTime}`) >= new Date())
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())[0];

  const filteredAppointments = appointments.filter(a => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Student Welcome Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {currentUser.displayName}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Student ({currentUser.studentId || currentUser.username})
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Department of {currentUser.department || 'Academic Affairs'} • Book faculty appointments with real-time Google Calendar availability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('book')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <CalendarCheck2 className="w-4 h-4" />
            Book Appointment
          </button>

          <button
            onClick={onOpenAIChat}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            AI Assistant
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'overview'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab('book')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'book'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Book New Appointment
        </button>
        <button
          onClick={() => setActiveTab('my-appointments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'my-appointments'
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          My Appointments ({appointments.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-bold text-slate-900">{appointments.length}</span>
                <span className="text-xs text-slate-500 block font-medium">Total Bookings</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-bold text-amber-700">{pendingCount}</span>
                <span className="text-xs text-slate-500 block font-medium">Pending Requests</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-bold text-emerald-700">{acceptedCount}</span>
                <span className="text-xs text-slate-500 block font-medium">Confirmed Upcoming</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-bold text-indigo-700">{completedCount}</span>
                <span className="text-xs text-slate-500 block font-medium">Completed Sessions</span>
              </div>
            </div>
          </div>

          {/* Next Confirmed Appointment Spotlight */}
          {nextAppointment ? (
            <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Next Confirmed Appointment
                  </span>
                  <h3 className="text-xl font-bold mt-2">{nextAppointment.purpose}</h3>
                  <p className="text-blue-200 text-sm mt-1">
                    Meeting with <strong>{nextAppointment.facultyName}</strong> ({nextAppointment.facultyEmail})
                  </p>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-blue-100">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-300" />
                      {nextAppointment.date}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-300" />
                      {nextAppointment.startTime} - {nextAppointment.endTime}
                    </span>
                    {nextAppointment.googleCalendarEventId && (
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle className="w-4 h-4" />
                        Google Calendar Synced
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCancellingAptId(nextAppointment.id)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel Session
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 text-center">
              <Calendar className="w-10 h-10 text-blue-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">No Upcoming Confirmed Appointments</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                You have no scheduled appointments. Browse faculty members and schedule a session during their working hours (9:00 AM – 4:00 PM).
              </p>
              <button
                onClick={() => setActiveTab('book')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Schedule an Appointment
              </button>
            </div>
          )}

          {/* Available Faculty Directory */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Department Faculty Directory</h3>
                <p className="text-xs text-slate-500">Working Hours: 9:00 AM – 4:00 PM • Calendar-based availability</p>
              </div>
              <button
                onClick={() => setActiveTab('book')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                Book with Faculty →
              </button>
            </div>

            {facultyList.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No faculty profiles available yet. The administrator must create faculty accounts.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {facultyList.map((faculty) => (
                  <div key={faculty.id} className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{faculty.name}</h4>
                          <span className="text-xs text-blue-600 font-medium block">{faculty.department}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{faculty.title}</span>
                        </div>
                        {faculty.isGoogleConnected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Not Linked
                          </span>
                        )}
                      </div>

                      {faculty.officeLocation && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{faculty.officeLocation}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedFacultyId(faculty.id);
                        setActiveTab('book');
                      }}
                      className="mt-4 w-full py-2 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Check Availability & Book
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOOK APPOINTMENT TAB (REQUIREMENTS 3, 4, 6) */}
      {activeTab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Booking Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Schedule Academic Appointment</h2>
              <p className="text-xs text-slate-500 mt-1">
                Faculty Working Hours: <strong>9:00 AM – 4:00 PM</strong>. Slots are derived strictly from the faculty's connected Google Calendar.
              </p>
            </div>

            {bookingSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            {bookingError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleBookSubmit} className="space-y-5">
              {/* 1. Faculty Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Faculty Member *
                </label>
                {facultyList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">No faculty profiles available. Contact administrator.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {facultyList.map((fac) => (
                      <button
                        type="button"
                        key={fac.id}
                        onClick={() => setSelectedFacultyId(fac.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          selectedFacultyId === fac.id
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-sm text-slate-900 block">{fac.name}</span>
                          {fac.isGoogleConnected ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Calendar Connected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              Not Linked
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 block truncate mt-0.5">{fac.department} • {fac.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Date Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  2. Select Appointment Date *
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 3. Slot Selection & Google Calendar Availability (REQUIREMENTS 4 & 6) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  3. Available Time Slots (9:00 AM – 4:00 PM) *
                </label>

                {checkingAvailability ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <Clock className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-600 font-medium">Checking faculty Google Calendar availability in real-time...</p>
                  </div>
                ) : availability && !availability.isConnected ? (
                  /* Requirement 6: Google Account Not Linked Message */
                  <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <h4 className="font-bold text-sm">Google Account Not Linked</h4>
                    </div>
                    <p className="text-xs text-amber-800 font-medium">
                      Kindly contact the faculty personally to schedule an appointment.
                    </p>
                    <p className="text-[11px] text-amber-700/80">
                      As per institutional scheduling rules, faculty availability is strictly determined by their connected Google Calendar. Because this faculty member has not linked their Google account, time slots cannot be booked online.
                    </p>
                  </div>
                ) : availability && availability.isConnected ? (
                  <div>
                    {availability.slots.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 text-xs">
                        No available slots on {bookingDate} between 9:00 AM and 4:00 PM. All slots are booked on their Google Calendar. Please select a different date.
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">
                          Displaying available slots verified against faculty Google Calendar (9:00 AM – 4:00 PM). Click to select:
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {availability.slots.map((slot) => {
                            const isSelected = selectedSlot?.startTime === slot.startTime;
                            return (
                              <button
                                type="button"
                                key={slot.startTime}
                                onClick={() => setSelectedSlot(slot)}
                                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/30'
                                    : 'bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                                }`}
                              >
                                {slot.startTime} - {slot.endTime}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Select a faculty member and date above to load available slots.</p>
                )}
              </div>

              {/* 4. Purpose */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  4. Appointment Purpose *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Thesis Guidance, Coursework Clarification, Lab Project Review"
                  value={bookingPurpose}
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  required
                  disabled={!availability?.isConnected}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Thesis Discussion', 'Coursework Clarification', 'Exam Review', 'Research Project', 'Academic Advising'].map(tag => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setBookingPurpose(tag)}
                      disabled={!availability?.isConnected}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-colors disabled:opacity-50"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Additional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  5. Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide context or specific questions for the professor..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  disabled={!availability?.isConnected}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:opacity-60"
                />
              </div>

              {/* Submit */}
              <div>
                <button
                  type="submit"
                  disabled={bookingLoading || !availability?.isConnected || !selectedSlot}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {bookingLoading ? 'Checking Calendar & Booking...' : 'Submit Appointment Request'}
                </button>
                {!availability?.isConnected && (
                  <p className="text-[11px] text-amber-700 text-center mt-2 font-medium">
                    Booking disabled: Faculty Google Calendar must be connected.
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Selected Faculty Details Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {selectedFaculty ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Faculty Information</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedFaculty.name}</h3>
                  <span className="text-xs text-slate-500 block">{selectedFaculty.title}</span>
                  <span className="text-xs text-slate-600 font-medium block">{selectedFaculty.department}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl space-y-2 text-xs text-slate-600 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Working Hours: <strong>9:00 AM – 4:00 PM</strong></span>
                  </div>
                  {selectedFaculty.officeLocation && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{selectedFaculty.officeLocation}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Google Calendar: {selectedFaculty.isGoogleConnected ? (
                      <strong className="text-emerald-600">Connected</strong>
                    ) : (
                      <strong className="text-amber-600">Not Linked</strong>
                    )}</span>
                  </div>
                </div>

                {selectedFaculty.bio && (
                  <div className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                    <p className="font-semibold text-slate-700 mb-1">About:</p>
                    <p>{selectedFaculty.bio}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-3xl p-6 text-center text-slate-400 text-xs border border-slate-200">
                Select a faculty member to see profile details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY APPOINTMENTS TAB */}
      {activeTab === 'my-appointments' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">My Appointment Records</h3>
              <p className="text-xs text-slate-500">Track pending confirmations, confirmed sessions, and cancellation history</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All ({appointments.length})</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Appointments in this Category</h4>
              <p className="text-xs text-slate-500 mt-1">Book an appointment with faculty to see it listed here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Faculty Member</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Purpose</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Calendar Sync</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{apt.facultyName}</span>
                        <span className="text-[11px] text-slate-400">{apt.facultyEmail}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <span className="font-semibold block">{apt.date}</span>
                        <span className="text-[11px] text-slate-500">{apt.startTime} - {apt.endTime}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{apt.purpose}</td>
                      <td className="py-3 px-3">
                        {apt.status === 'accepted' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Accepted
                          </span>
                        )}
                        {apt.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pending
                          </span>
                        )}
                        {apt.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            Rejected
                          </span>
                        )}
                        {apt.status === 'cancelled' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Cancelled
                          </span>
                        )}
                      </td>
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
                        {(apt.status === 'pending' || apt.status === 'accepted') && (
                          <button
                            onClick={() => setCancellingAptId(apt.id)}
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingAptId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cancel Appointment?</h3>
                <p className="text-xs text-slate-500">The session will be cancelled and removed from calendar.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for cancellation (optional):</label>
              <textarea
                rows={2}
                placeholder="Brief reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setCancellingAptId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelAppointment}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Yes, Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
