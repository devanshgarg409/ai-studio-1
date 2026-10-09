import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Appointment, 
  FacultyProfile, 
  StudentProfile, 
  GeminiAdminConfig, 
  User,
  DatabaseStatusInfo,
  SyncedFacultyDatabaseInfo,
  SyncedCalendarEvent 
} from '../types';
import { 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  RefreshCw, 
  Clock, 
  CalendarDays, 
  Users, 
  GraduationCap, 
  Check, 
  Lock,
  ExternalLink,
  UserPlus,
  Edit2,
  Trash2,
  Power,
  Shield,
  Search,
  School,
  X,
  Plus,
  Database,
  HardDrive,
  FileJson,
  Layers,
  Sparkles,
  Eye,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';

interface Props {
  currentUser: User;
  onOpenAIChat: () => void;
  onOpenGoogleIntegration: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ currentUser, onOpenAIChat, onOpenGoogleIntegration }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'faculty' | 'appointments' | 'gemini' | 'database'>('students');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [geminiConfig, setGeminiConfig] = useState<GeminiAdminConfig | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatusInfo | null>(null);
  const [syncingCalendars, setSyncingCalendars] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedFacultyForCalendar, setSelectedFacultyForCalendar] = useState<SyncedFacultyDatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateStudentOpen, setIsCreateStudentOpen] = useState(false);
  const [isCreateFacultyOpen, setIsCreateFacultyOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<FacultyProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'student' | 'faculty'; id: string; name: string } | null>(null);

  // New Student Form state
  const [studentForm, setStudentForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    department: 'Computer Science & Engineering',
    studentId: '',
    phone: ''
  });

  // New Faculty Form state
  const [facultyForm, setFacultyForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    department: 'Computer Science & Engineering',
    title: 'Assistant Professor',
    officeLocation: 'Science Complex 402',
    bio: ''
  });

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Gemini API Key & Model state
  const [newApiKey, setNewApiKey] = useState('');
  const [updatingKey, setUpdatingKey] = useState(false);
  const [keyUpdateMessage, setKeyUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemma-4-26b-a4b-it');
  const [updatingModel, setUpdatingModel] = useState(false);
  const [modelUpdateMessage, setModelUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gemini Connection Test state
  const [testingGemini, setTestingGemini] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [studs, facs, apts, gConfig, dStatus] = await Promise.all([
        api.getAdminStudents(),
        api.getAdminFaculty(),
        api.getAppointments(),
        api.getGeminiAdminConfig(),
        api.getDatabaseStatus().catch(() => null)
      ]);
      setStudents(studs);
      setFacultyList(facs);
      setAppointments(apts);
      setGeminiConfig(gConfig);
      setDbStatus(dStatus);
      if (gConfig?.model) {
        setSelectedModel(gConfig.model);
      }
    } catch (err: any) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSyncAll = async () => {
    setSyncingCalendars(true);
    setSyncResult(null);
    try {
      const res = await api.syncAllCalendars();
      setSyncResult({
        success: true,
        message: `Synced ${res.syncedCount} Google Calendar accounts successfully at ${new Date(res.lastPeriodicSync).toLocaleTimeString()} (${res.errors} errors). Database cache and slots updated in Firebase Firestore.`
      });
      await loadAllData();
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Failed to trigger Google Calendar sync.'
      });
    } finally {
      setSyncingCalendars(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [currentUser.id]);

  // Create Student Handler
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.username || !studentForm.password || !studentForm.name || !studentForm.email || !studentForm.studentId) {
      setFormError('Please fill in all required fields (User ID, Password, Name, Email, Student ID).');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      await api.createAdminStudent(studentForm);
      setIsCreateStudentOpen(false);
      setStudentForm({
        username: '',
        password: '',
        name: '',
        email: '',
        department: 'Computer Science & Engineering',
        studentId: '',
        phone: ''
      });
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create student profile.');
    } finally {
      setFormLoading(false);
    }
  };

  // Create Faculty Handler
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyForm.username || !facultyForm.password || !facultyForm.name || !facultyForm.email || !facultyForm.title) {
      setFormError('Please fill in all required fields (User ID, Password, Name, Email, Title).');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      await api.createAdminFaculty(facultyForm);
      setIsCreateFacultyOpen(false);
      setFacultyForm({
        username: '',
        password: '',
        name: '',
        email: '',
        department: 'Computer Science & Engineering',
        title: 'Assistant Professor',
        officeLocation: 'Science Complex 402',
        bio: ''
      });
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create faculty profile.');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Student Handler
  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      setFormLoading(true);
      setFormError(null);
      await api.updateAdminStudent(editingStudent.id, editForm);
      setEditingStudent(null);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update student profile.');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Faculty Handler
  const handleSaveFacultyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;
    try {
      setFormLoading(true);
      setFormError(null);
      await api.updateAdminFaculty(editingFaculty.id, editForm);
      setEditingFaculty(null);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update faculty profile.');
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle Status Handler
  const handleToggleStudentStatus = async (student: StudentProfile) => {
    try {
      await api.toggleAdminStudentStatus(student.id, !student.disabled);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleToggleFacultyStatus = async (faculty: FacultyProfile) => {
    try {
      await api.toggleAdminFacultyStatus(faculty.id, !faculty.disabled);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'student') {
        await api.deleteAdminStudent(deleteConfirm.id);
      } else {
        await api.deleteAdminFaculty(deleteConfirm.id);
      }
      setDeleteConfirm(null);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete profile');
    }
  };

  // Gemini Key update
  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingKey(true);
      setKeyUpdateMessage(null);
      const res = await api.updateGeminiApiKey(newApiKey);
      setKeyUpdateMessage({ type: 'success', text: res.message });
      setNewApiKey('');
      const updated = await api.getGeminiAdminConfig();
      setGeminiConfig(updated);
    } catch (err: any) {
      setKeyUpdateMessage({ type: 'error', text: err.message || 'Failed to update Gemini API key.' });
    } finally {
      setUpdatingKey(false);
    }
  };

  // LLM Model update
  const handleUpdateModel = async (modelToSave: string) => {
    try {
      setUpdatingModel(true);
      setModelUpdateMessage(null);
      await api.updateGeminiModel(modelToSave);
      setModelUpdateMessage({ type: 'success', text: `LLM Model successfully updated to "${modelToSave}".` });
      const updated = await api.getGeminiAdminConfig();
      setGeminiConfig(updated);
      setSelectedModel(updated.model);
    } catch (err: any) {
      setModelUpdateMessage({ type: 'error', text: err.message || 'Failed to update LLM Model.' });
    } finally {
      setUpdatingModel(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingGemini(true);
      setTestResult(null);
      const res = await api.testGeminiConnection();
      setTestResult({
        success: true,
        message: `Successfully connected to ${res.model}! Test output: "${res.testResponse}"`
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gemini connectivity test failed.'
      });
    } finally {
      setTestingGemini(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaculty = facultyList.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">System Administration Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Admin Exclusive
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Logged in as <strong>{currentUser.displayName}</strong> (User ID: <code className="text-rose-300 font-mono">{currentUser.username}</code>). Manage Student & Faculty profiles, Gemini LLM key, and schedule policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2 border border-slate-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>30-min Google Sync: <strong>Active</strong></span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <School className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{students.length}</span>
            <span className="text-xs text-slate-500 block font-medium">Student Profiles</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-indigo-700">{facultyList.length}</span>
            <span className="text-xs text-slate-500 block font-medium">Faculty Profiles</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold text-emerald-700">{appointments.length}</span>
            <span className="text-xs text-slate-500 block font-medium">Total Appointments</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-bold text-purple-700 block">
              {geminiConfig?.isConfigured ? 'Operational' : 'Key Missing'}
            </span>
            <span className="text-xs text-slate-500 block font-medium">Common Gemini LLM</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'students'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <School className="w-3.5 h-3.5" />
            Student Profiles ({students.length})
          </button>

          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'faculty'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Faculty Profiles ({facultyList.length})
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'appointments'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Master Appointments ({appointments.length})
          </button>

          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'gemini'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Gemini AI Settings
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'database'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Persistent Database & Calendar Cache
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'database' && (
            <button
              onClick={handleTriggerSyncAll}
              disabled={syncingCalendars}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCalendars ? 'animate-spin' : ''}`} />
              {syncingCalendars ? 'Syncing Calendars...' : 'Sync All Calendars Now'}
            </button>
          )}

          {activeTab === 'students' && (
            <button
              onClick={() => {
                setFormError(null);
                setIsCreateStudentOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Student Profile
            </button>
          )}

          {activeTab === 'faculty' && (
            <button
              onClick={() => {
                setFormError(null);
                setIsCreateFacultyOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Faculty Profile
            </button>
          )}
        </div>
      </div>

      {/* ----------------- TAB: STUDENTS ----------------- */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Student Directory & Profiles</h2>
              <p className="text-xs text-slate-500">
                Created by Administrator. Students use their assigned User ID & Password to sign in.
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students by name, ID, or dept..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {students.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Student Profiles Created</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                As per initial setup rules, no student profiles exist until created by the Admin.
              </p>
              <button
                onClick={() => {
                  setFormError(null);
                  setIsCreateStudentOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Student Profile
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">User ID</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Student ID</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-700">
                        {student.username}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {student.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{student.email}</td>
                      <td className="py-3 px-3 text-slate-600">{student.department}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{student.studentId}</td>
                      <td className="py-3 px-3 text-slate-500">{student.phone || '—'}</td>
                      <td className="py-3 px-3">
                        {student.disabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                            Disabled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingStudent(student);
                              setEditForm({
                                name: student.name,
                                email: student.email,
                                department: student.department,
                                studentId: student.studentId,
                                phone: student.phone || '',
                                password: ''
                              });
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStudentStatus(student)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              student.disabled 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title={student.disabled ? 'Enable Profile' : 'Disable Profile'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ type: 'student', id: student.id, name: student.name })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ----------------- TAB: FACULTY ----------------- */}
      {activeTab === 'faculty' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Faculty Directory & Profiles</h2>
              <p className="text-xs text-slate-500">
                Working Hours: <strong>9:00 AM – 4:00 PM</strong>. Individual availability determined strictly from connected Google Calendars.
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search faculty by name, dept, title..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {facultyList.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Faculty Profiles Created</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                As per initial setup rules, no faculty profiles exist until created by the Admin.
              </p>
              <button
                onClick={() => {
                  setFormError(null);
                  setIsCreateFacultyOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Faculty Profile
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">User ID</th>
                    <th className="py-3 px-3">Faculty Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Title</th>
                    <th className="py-3 px-3">Office</th>
                    <th className="py-3 px-3">Google Calendar</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFaculty.map((faculty) => (
                    <tr key={faculty.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                        {faculty.username}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {faculty.name}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{faculty.email}</td>
                      <td className="py-3 px-3 text-slate-600">{faculty.department}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{faculty.title}</td>
                      <td className="py-3 px-3 text-slate-500">{faculty.officeLocation || '—'}</td>
                      <td className="py-3 px-3">
                        {faculty.isGoogleConnected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit" title="Not connected: Students will be prompted to contact faculty directly">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Not Linked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {faculty.disabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                            Disabled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingFaculty(faculty);
                              setEditForm({
                                name: faculty.name,
                                email: faculty.email,
                                department: faculty.department,
                                title: faculty.title,
                                officeLocation: faculty.officeLocation || '',
                                bio: faculty.bio || '',
                                password: ''
                              });
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleFacultyStatus(faculty)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              faculty.disabled 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title={faculty.disabled ? 'Enable Profile' : 'Disable Profile'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm({ type: 'faculty', id: faculty.id, name: faculty.name })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ----------------- TAB: MASTER APPOINTMENTS ----------------- */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Institution Appointments Master Log</h3>
            <p className="text-xs text-slate-500">Live monitoring of all student-faculty appointments and statuses</p>
          </div>

          {appointments.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Appointments Scheduled Yet</h4>
              <p className="text-xs text-slate-500 mt-1">
                Appointments are created when students book with faculty members whose Google Calendars are connected.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Student</th>
                    <th className="py-3 px-3">Faculty Member</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Purpose</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Google Cal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {apt.studentName}
                        <span className="text-[11px] text-slate-400 block">{apt.studentEmail}</span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {apt.facultyName}
                        <span className="text-[11px] text-slate-400 block">{apt.facultyEmail}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="font-semibold text-slate-800 block">{apt.date}</span>
                        <span className="text-[11px] text-slate-500">{apt.startTime} - {apt.endTime}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate">
                        {apt.purpose}
                      </td>
                      <td className="py-3 px-3">
                        {apt.status === 'accepted' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Accepted
                          </span>
                        )}
                        {apt.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            Pending
                          </span>
                        )}
                        {apt.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                            Rejected
                          </span>
                        )}
                        {apt.status === 'cancelled' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {apt.googleCalendarEventId ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Synced
                          </span>
                        ) : (
                          <span className="text-slate-400">Manual</span>
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

      {/* ----------------- TAB: GEMINI AI ----------------- */}
      {activeTab === 'gemini' && (
        <div className="bg-white rounded-2xl p-6 border-2 border-indigo-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">LLM Architecture & Model Configuration</h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                    Admin Privilege
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the underlying Large Language Model and API credentials for AcademiaSync. The default model is <strong>Gemma 4 e4b (gemma-4-26b-a4b-it)</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingGemini || !geminiConfig?.isConfigured}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testingGemini ? 'animate-spin' : ''}`} />
              {testingGemini ? 'Testing LLM...' : 'Test LLM Connection'}
            </button>
          </div>

          {/* Status Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Active Key Source:</span>
              <span className="font-semibold text-slate-800">
                {geminiConfig?.source === 'custom' ? 'Admin Custom Override' : geminiConfig?.source === 'env' ? 'Backend Environment (GEMINI_API_KEY)' : 'None'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Masked Key:</span>
              <span className="font-mono font-semibold text-slate-800">
                {geminiConfig?.maskedKey || 'Not configured'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Active Model:</span>
              <span className="font-mono font-semibold text-indigo-600 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                {geminiConfig?.model || 'gemma-4-26b-a4b-it'}
              </span>
            </div>
          </div>

          {/* Test Result Alert */}
          {testResult && (
            <div className={`p-4 rounded-xl text-xs flex items-center justify-between ${
              testResult.success 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
              <button onClick={() => setTestResult(null)} className="text-xs opacity-60 hover:opacity-100">Dismiss</button>
            </div>
          )}

          {/* ----------------- MODEL SELECTION SECTION ----------------- */}
          <div className="p-5 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-purple-50/30 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  Select LLM Model
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which model powers the AI Appointment Assistant for natural language scheduling and calendar checks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                  Active: {geminiConfig?.model || 'gemma-4-26b-a4b-it'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  id: 'gemma-4-26b-a4b-it',
                  name: 'Gemma 4 e4b (26B A4B IT)',
                  badge: 'DEFAULT MODEL',
                  badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  desc: 'Default Gemma 4 compact model with low latency and native function calling for Google Calendar appointments.'
                },
                {
                  id: 'gemma-4-31b-it',
                  name: 'Gemma 4 31B IT',
                  badge: 'HIGH CAPACITY',
                  badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                  desc: 'Expanded Gemma model architecture with higher reasoning capacity for complex dialogs.'
                },
                {
                  id: 'gemini-3.8-flash',
                  name: 'Gemini 3.8 Flash',
                  badge: 'FLAGSHIP SPEED',
                  badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
                  desc: 'Ultra-fast multimodal flagship model, optimized for reasoning and sub-second tool execution.'
                },
                {
                  id: 'gemini-3.1-flash-lite',
                  name: 'Gemini 3.1 Flash Lite',
                  badge: 'LOW LATENCY',
                  badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
                  desc: 'Extremely lightweight, cost-effective model designed for high-throughput responses.'
                },
                {
                  id: 'gemini-2.5-flash',
                  name: 'Gemini 2.5 Flash',
                  badge: 'STANDARD',
                  badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
                  desc: 'Proven fast flash tier suitable for general scheduling prompts.'
                },
                {
                  id: 'gemini-2.5-pro',
                  name: 'Gemini 2.5 Pro',
                  badge: 'DEEP REASONING',
                  badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
                  desc: 'Advanced reasoning model with deep analysis capabilities for complex scheduling constraints.'
                }
              ].map((m) => {
                const isSelected = selectedModel === m.id;
                const isCurrentActive = geminiConfig?.model === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                      isSelected 
                        ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 shadow-sm' 
                        : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="font-bold text-slate-900">{m.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m.badgeColor}`}>
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">{m.desc}</p>
                    </div>

                    <div className="mt-3 pl-6 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-100 pt-2">
                      <span>{m.id}</span>
                      {isCurrentActive ? (
                        <span className="text-emerald-700 font-sans font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                          <Check className="w-3 h-3" /> Active Model
                        </span>
                      ) : (
                        isSelected && (
                          <span className="text-indigo-600 font-sans font-semibold text-[10px]">
                            Ready to apply
                          </span>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-indigo-100/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateModel(selectedModel)}
                  disabled={updatingModel || selectedModel === geminiConfig?.model}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  {updatingModel ? 'Applying Model...' : `Apply "${selectedModel}"`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel('gemma-4-26b-a4b-it');
                    handleUpdateModel('gemma-4-26b-a4b-it');
                  }}
                  disabled={updatingModel || geminiConfig?.model === 'gemma-4-26b-a4b-it'}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
                >
                  Reset to Gemma 4 (Default)
                </button>
              </div>

              {modelUpdateMessage && (
                <span className={`text-xs font-medium ${modelUpdateMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {modelUpdateMessage.text}
                </span>
              )}
            </div>
          </div>

          {/* Key Update Form */}
          <form onSubmit={handleUpdateApiKey} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Update Gemini API Key (Admin Privilege)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Paste new Gemini API Key from Google AI Studio (AIza...)"
                className="flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={updatingKey || !newApiKey.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                {updatingKey ? 'Updating...' : 'Save New Gemini Key'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.updateGeminiApiKey('');
                  const updated = await api.getGeminiAdminConfig();
                  setGeminiConfig(updated);
                  setKeyUpdateMessage({ type: 'success', text: 'Reverted to environment GEMINI_API_KEY default.' });
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors shrink-0"
              >
                Reset to Env Default
              </button>
            </div>

            {keyUpdateMessage && (
              <p className={`text-xs font-medium mt-1.5 ${keyUpdateMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {keyUpdateMessage.text}
              </p>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Obtain your Gemini API key from Google AI Studio. Stored securely on the backend server.
              </span>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                Get Gemini Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </form>
        </div>
      )}

      {/* ----------------- TAB: PERSISTENT DATABASE & CALENDAR CACHE ----------------- */}
      {activeTab === 'database' && (
        <div className="bg-white rounded-2xl p-6 border-2 border-amber-200 shadow-sm space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Firebase Firestore Persistent Database</h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Operational & Synced
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  All student and faculty accounts, salted scrypt login credentials, Google OAuth tokens, LLM model settings, and synced Google Calendar events are permanently stored in Firebase Firestore.
                </p>
              </div>
            </div>

            <button
              onClick={handleTriggerSyncAll}
              disabled={syncingCalendars}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${syncingCalendars ? 'animate-spin' : ''}`} />
              {syncingCalendars ? 'Syncing Calendars...' : 'Sync All Calendars to DB'}
            </button>
          </div>

          {/* Sync Result Alert */}
          {syncResult && (
            <div className={`p-4 rounded-xl text-xs flex items-center justify-between ${
              syncResult.success 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {syncResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{syncResult.message}</span>
              </div>
              <button onClick={() => setSyncResult(null)} className="text-xs opacity-60 hover:opacity-100">Dismiss</button>
            </div>
          )}

          {/* Cloud Instance Info */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Firebase Project ID:</span>
              <span className="font-mono font-semibold text-slate-800">
                {dbStatus?.projectId || 'gen-lang-client-0499327347'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Firestore Database:</span>
              <span className="font-mono font-semibold text-slate-800">
                {dbStatus?.firestoreDatabaseId || 'ai-studio-5f918953-2b5a-44bc-afa3-ce6f8b245f41'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Last Periodic Calendar Sync:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                {dbStatus?.lastPeriodicSync ? new Date(dbStatus.lastPeriodicSync).toLocaleTimeString() : 'Active (every 30m)'}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Active LLM Model:</span>
              <span className="font-mono font-semibold text-indigo-600 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                {dbStatus?.llmModel || geminiConfig?.model || 'gemma-4-26b-a4b-it'}
              </span>
            </div>
          </div>

          {/* Persistent Collections Summary Cards */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              Persistent Firestore Collections & Record Counts
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/users</span>
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.users ?? (students.length + facultyList.length + 1)}
                </div>
                <div className="text-[11px] text-slate-500">User accounts, roles, & scrypt password hashes</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/students</span>
                  <School className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.students ?? students.length}
                </div>
                <div className="text-[11px] text-slate-500">Student directory & academic records</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/faculty_profiles</span>
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.faculty ?? facultyList.length}
                </div>
                <div className="text-[11px] text-slate-500">Faculty directory & Google Calendar link flag</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/appointments</span>
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.appointments ?? appointments.length}
                </div>
                <div className="text-[11px] text-slate-500">Appointments synced with Google Calendar IDs</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/google_configs</span>
                  <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.googleConfigs ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">Per-user Google OAuth client credentials</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/google_tokens</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {dbStatus?.counts.googleTokens ?? 0}
                </div>
                <div className="text-[11px] text-slate-500">OAuth access tokens & refresh tokens</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-amber-700 font-semibold">
                  <span>/calendar_events</span>
                  <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-900">
                  {dbStatus?.counts.syncedCalendarEvents ?? 0}
                </div>
                <div className="text-[11px] text-amber-800">Cached Google events for collision checks</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>/system_settings</span>
                  <Cpu className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-xl font-bold text-slate-900">
                  1 Config
                </div>
                <div className="text-[11px] text-slate-500">Active LLM model: Gemma 4 e4b & custom API key</div>
              </div>
            </div>
          </div>

          {/* Synced Faculty Calendar Details Table */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  Synced Faculty Google Calendars & Database State
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The application database caches each faculty member's Google Calendar events and updates automatically after every sync.
                </p>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                {dbStatus?.syncedFaculty?.length || facultyList.length} Faculty Records
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">Faculty Member</th>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4">Google Calendar Status</th>
                    <th className="py-2.5 px-4">Cached Events in DB</th>
                    <th className="py-2.5 px-4">Last Synced</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(dbStatus?.syncedFaculty || facultyList.map((f): SyncedFacultyDatabaseInfo => ({
                    facultyId: f.id,
                    facultyName: f.name,
                    userId: f.userId,
                    isGoogleConnected: Boolean(f.isGoogleConnected),
                    googleEmail: f.googleEmail,
                    eventsCount: 0,
                    lastSyncedAt: undefined,
                    events: []
                  }))).map((fac) => (
                    <tr key={fac.facultyId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{fac.facultyName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{fac.userId}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {facultyList.find(f => f.id === fac.facultyId)?.department || 'Academic Department'}
                      </td>
                      <td className="py-3 px-4">
                        {fac.isGoogleConnected ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {fac.googleEmail || 'Linked to Google'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Not Linked
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{fac.eventsCount}</span>
                        <span className="text-slate-400 ml-1">events</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {fac.lastSyncedAt ? new Date(fac.lastSyncedAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fac.eventsCount > 0 ? (
                          <button
                            onClick={() => setSelectedFacultyForCalendar(fac)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect Cached Events
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No events cached</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Database Schema Reference */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-600" />
              Synced Google Calendar Schema in Database (`/calendar_events`)
            </h4>
            <p className="text-xs text-slate-600">
              Each synced calendar event is persisted with the following typed JSON schema to allow deterministic interval collision detection between 09:00 AM and 04:00 PM:
            </p>
            <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
              <pre>{`interface CalendarEvent {
  id: string;              // Unique internal event identifier
  userId: string;          // Faculty or Student User ID
  googleEventId?: string;  // Google Calendar event ID for two-way synchronization
  summary: string;         // Meeting / Lecture / Academic purpose
  description?: string;    // Meeting notes or syllabus topic
  start: string;           // RFC3339 start timestamp with local timezone offset
  end: string;             // RFC3339 end timestamp with local timezone offset
  location?: string;       // Room or Google Meet conference link
  isAppointment: boolean;  // Flag indicating if created by AcademiaSync
  appointmentId?: string;  // Link back to /appointments/{appointmentId}
  syncedAt: string;        // Timestamp updated after each synchronization
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: INSPECT CACHED CALENDAR EVENTS ----------------- */}
      {selectedFacultyForCalendar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cached Google Calendar Events
                  </h3>
                  <p className="text-xs text-slate-500">
                    Faculty: <strong>{selectedFacultyForCalendar.facultyName}</strong> ({selectedFacultyForCalendar.eventsCount} events in database)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFacultyForCalendar(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {selectedFacultyForCalendar.events.map((evt, idx) => (
                <div key={evt.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900">{evt.summary}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${evt.isAppointment ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>
                      {evt.isAppointment ? 'App Appointment' : 'Google Busy Slot'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evt.start.split('T')[0]} {evt.start.split('T')[1]?.substring(0, 5)} - {evt.end.split('T')[1]?.substring(0, 5)}
                    </span>
                    {evt.location && (
                      <span className="text-slate-600">{evt.location}</span>
                    )}
                  </div>
                  {evt.googleEventId && (
                    <div className="text-[10px] font-mono text-slate-400">
                      Google Event ID: {evt.googleEventId}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedFacultyForCalendar(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: CREATE STUDENT ----------------- */}
      {isCreateStudentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Create Student Profile</h3>
                  <p className="text-xs text-slate-500">Add a new student account to AcademiaSync</p>
                </div>
              </div>
              <button onClick={() => setIsCreateStudentOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">User ID * (Login ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. s_john"
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Set student password"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="john@institution.edu"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science"
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student ID # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-2026-081"
                    value={studentForm.studentId}
                    onChange={(e) => setStudentForm({ ...studentForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="+1 (555) 019-2834"
                  value={studentForm.phone}
                  onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateStudentOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  {formLoading ? 'Creating Profile...' : 'Create Student Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: CREATE FACULTY ----------------- */}
      {isCreateFacultyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Create Faculty Profile</h3>
                  <p className="text-xs text-slate-500">Add a faculty member with working hours 9:00 AM – 4:00 PM</p>
                </div>
              </div>
              <button onClick={() => setIsCreateFacultyOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFaculty} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">User ID * (Login ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. prof_smith"
                    value={facultyForm.username}
                    onChange={(e) => setFacultyForm({ ...facultyForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Set faculty password"
                    value={facultyForm.password}
                    onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Jane Smith"
                    value={facultyForm.name}
                    onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="jsmith@institution.edu"
                    value={facultyForm.email}
                    onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science"
                    value={facultyForm.department}
                    onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Professor / Associate Dean"
                    value={facultyForm.title}
                    onChange={(e) => setFacultyForm({ ...facultyForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Office Location</label>
                <input
                  type="text"
                  placeholder="e.g. Turing Hall, Room 310"
                  value={facultyForm.officeLocation}
                  onChange={(e) => setFacultyForm({ ...facultyForm, officeLocation: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bio / Research Interests</label>
                <textarea
                  rows={2}
                  placeholder="Research areas, academic background, student advising focus..."
                  value={facultyForm.bio}
                  onChange={(e) => setFacultyForm({ ...facultyForm, bio: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateFacultyOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  {formLoading ? 'Creating Profile...' : 'Create Faculty Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT STUDENT ----------------- */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Student Profile</h3>
                  <p className="text-xs text-slate-500">Editing User ID: <strong>{editingStudent.username}</strong></p>
                </div>
              </div>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudentEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student ID</label>
                  <input
                    type="text"
                    required
                    value={editForm.studentId || ''}
                    onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep existing password"
                  value={editForm.password || ''}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: EDIT FACULTY ----------------- */}
      {editingFaculty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Faculty Profile</h3>
                  <p className="text-xs text-slate-500">Editing User ID: <strong>{editingFaculty.username}</strong></p>
                </div>
              </div>
              <button onClick={() => setEditingFaculty(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveFacultyEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Title</label>
                  <input
                    type="text"
                    required
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Office Location</label>
                <input
                  type="text"
                  value={editForm.officeLocation || ''}
                  onChange={(e) => setEditForm({ ...editForm, officeLocation: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editForm.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep existing password"
                  value={editForm.password || ''}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: DELETE CONFIRMATION ----------------- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Profile?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete the {deleteConfirm.type} profile for <strong>{deleteConfirm.name}</strong>? Their login user account and profile data will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Yes, Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
