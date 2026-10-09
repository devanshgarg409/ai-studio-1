export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  username: string; // User ID for login
  passwordHash?: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  studentId?: string;
  title?: string;
  phone?: string;
  avatarUrl?: string;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacultyProfile {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  department: string;
  title: string;
  officeLocation?: string;
  bio?: string;
  disabled?: boolean;
  isGoogleConnected?: boolean;
  googleEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  department: string;
  studentId: string;
  phone?: string;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'pending' | 'accepted' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  facultyId: string;
  facultyName: string;
  facultyEmail: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24h)
  endTime: string; // HH:MM (24h)
  purpose: string;
  notes?: string;
  status: AppointmentStatus;
  rejectionReason?: string;
  googleCalendarEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface FacultyAvailabilityResponse {
  facultyId: string;
  facultyName: string;
  date: string;
  isConnected: boolean;
  message?: string;
  workingHours: string;
  slots: TimeSlot[];
}

export interface GoogleClientConfig {
  client_id: string;
  client_secret: string;
  project_id?: string;
  auth_uri?: string;
  token_uri?: string;
  redirect_uris?: string[];
}

export interface GoogleAuthStatus {
  hasCredentials: boolean;
  clientIdMasked?: string;
  isAuthorized: boolean;
  googleEmail?: string;
  expiryDate?: number;
  lastSyncedAt?: string;
  syncedEventsCount?: number;
}

export interface SyncedCalendarEvent {
  id: string;
  userId: string;
  googleEventId?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  isAppointment?: boolean;
  appointmentId?: string;
  syncedAt?: string;
}

export interface ChatToolCall {
  name: string;
  args: Record<string, any>;
  result?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ChatToolCall[];
}

export interface GeminiAdminConfig {
  source: 'env' | 'custom';
  isConfigured: boolean;
  maskedKey: string;
  model: string;
  availableModels?: { id: string; name: string }[];
  lastTested?: string;
  status: 'operational' | 'error' | 'unconfigured';
}

export interface SyncedFacultyDatabaseInfo {
  facultyId: string;
  facultyName: string;
  userId: string;
  isGoogleConnected: boolean;
  googleEmail?: string;
  eventsCount: number;
  lastSyncedAt?: string;
  events: SyncedCalendarEvent[];
}

export interface DatabaseStatusInfo {
  status: 'connected' | 'error';
  projectId: string;
  firestoreDatabaseId: string;
  counts: {
    users: number;
    students: number;
    faculty: number;
    appointments: number;
    googleConfigs: number;
    googleTokens: number;
    syncedCalendarEvents: number;
  };
  llmModel: string;
  hasCustomGeminiApiKey: boolean;
  lastPeriodicSync: string;
  syncedFaculty: SyncedFacultyDatabaseInfo[];
}
