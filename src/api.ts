import { 
  Appointment, 
  FacultyProfile, 
  StudentProfile, 
  GoogleAuthStatus, 
  SyncedCalendarEvent, 
  User, 
  GeminiAdminConfig, 
  ChatMessage,
  FacultyAvailabilityResponse,
  DatabaseStatusInfo 
} from './types';

class ApiClient {
  private currentUserId: string = '';

  constructor() {
    const saved = localStorage.getItem('academiasync_user_id');
    if (saved) {
      this.currentUserId = saved;
    }
  }

  setUserId(id: string) {
    this.currentUserId = id;
    if (id) {
      localStorage.setItem('academiasync_user_id', id);
    } else {
      localStorage.removeItem('academiasync_user_id');
    }
  }

  getUserId(): string {
    return this.currentUserId || localStorage.getItem('academiasync_user_id') || '';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const tz = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata') : 'Asia/Kolkata';
    const headers = {
      'Content-Type': 'application/json',
      'x-user-id': this.getUserId(),
      'x-timezone': tz,
      ...(options.headers || {})
    };

    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errorMsg = `API Error: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // ---------------- AUTH ---------------- //
  async login(username: string, password: string): Promise<User> {
    const data = await this.request<{ success: boolean; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setUserId(data.user.id);
    return data.user;
  }

  logout() {
    this.setUserId('');
    localStorage.removeItem('academiasync_user_id');
    localStorage.removeItem('academiasync_session_user');
  }

  async getCurrentUser(): Promise<User> {
    const data = await this.request<{ user: User }>('/api/users/current');
    return data.user;
  }

  // ---------------- ADMIN PROFILE MANAGEMENT (REQUIREMENT 2) ---------------- //
  async getAdminStudents(): Promise<StudentProfile[]> {
    const data = await this.request<{ students: StudentProfile[] }>('/api/admin/students');
    return data.students;
  }

  async createAdminStudent(studentData: {
    username: string;
    password: string;
    name: string;
    email: string;
    department: string;
    studentId: string;
    phone?: string;
  }): Promise<StudentProfile> {
    const data = await this.request<{ student: StudentProfile }>('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
    return data.student;
  }

  async updateAdminStudent(id: string, updates: Partial<StudentProfile & { password?: string }>): Promise<StudentProfile> {
    const data = await this.request<{ student: StudentProfile }>(`/api/admin/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.student;
  }

  async toggleAdminStudentStatus(id: string, disabled: boolean): Promise<StudentProfile> {
    const data = await this.request<{ student: StudentProfile }>(`/api/admin/students/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ disabled })
    });
    return data.student;
  }

  async deleteAdminStudent(id: string): Promise<void> {
    await this.request(`/api/admin/students/${id}`, { method: 'DELETE' });
  }

  async getAdminFaculty(): Promise<FacultyProfile[]> {
    const data = await this.request<{ faculty: FacultyProfile[] }>('/api/admin/faculty');
    return data.faculty;
  }

  async createAdminFaculty(facultyData: {
    username: string;
    password: string;
    name: string;
    email: string;
    department: string;
    title: string;
    officeLocation?: string;
    bio?: string;
  }): Promise<FacultyProfile> {
    const data = await this.request<{ faculty: FacultyProfile }>('/api/admin/faculty', {
      method: 'POST',
      body: JSON.stringify(facultyData)
    });
    return data.faculty;
  }

  async updateAdminFaculty(id: string, updates: Partial<FacultyProfile & { password?: string }>): Promise<FacultyProfile> {
    const data = await this.request<{ faculty: FacultyProfile }>(`/api/admin/faculty/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.faculty;
  }

  async toggleAdminFacultyStatus(id: string, disabled: boolean): Promise<FacultyProfile> {
    const data = await this.request<{ faculty: FacultyProfile }>(`/api/admin/faculty/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ disabled })
    });
    return data.faculty;
  }

  async deleteAdminFaculty(id: string): Promise<void> {
    await this.request(`/api/admin/faculty/${id}`, { method: 'DELETE' });
  }

  // ---------------- FACULTY & CALENDAR AVAILABILITY (REQUIREMENTS 3, 4, 6) ---------------- //
  async getFacultyList(): Promise<FacultyProfile[]> {
    const data = await this.request<{ faculty: FacultyProfile[] }>('/api/faculty');
    return data.faculty;
  }

  async getFacultyAvailability(facultyId: string, date: string): Promise<FacultyAvailabilityResponse> {
    return this.request<FacultyAvailabilityResponse>(`/api/faculty/${facultyId}/availability?date=${encodeURIComponent(date)}`);
  }

  // ---------------- APPOINTMENTS ---------------- //
  async getAppointments(): Promise<Appointment[]> {
    const data = await this.request<{ appointments: Appointment[] }>('/api/appointments');
    return data.appointments;
  }

  async createAppointment(appointmentData: {
    facultyId: string;
    date: string;
    startTime: string;
    endTime: string;
    purpose: string;
    notes?: string;
  }): Promise<Appointment> {
    const data = await this.request<{ appointment: Appointment }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData)
    });
    return data.appointment;
  }

  async updateAppointmentStatus(id: string, status: string, rejectionReason?: string): Promise<Appointment> {
    const data = await this.request<{ appointment: Appointment }>(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason })
    });
    return data.appointment;
  }

  // ---------------- GOOGLE INTEGRATION ---------------- //
  async uploadGoogleConfig(configData: any): Promise<{ success: boolean; clientIdMasked: string; message: string }> {
    return this.request('/api/google/upload-config', {
      method: 'POST',
      body: JSON.stringify({ configData })
    });
  }

  async getGoogleStatus(): Promise<{ status: GoogleAuthStatus; user: { id: string; email: string; name: string } }> {
    return this.request('/api/google/status');
  }

  async getGoogleAuthUrl(): Promise<string> {
    const data = await this.request<{ authUrl: string }>('/api/google/auth-url');
    return data.authUrl;
  }

  async simulateGoogleAuth(email?: string): Promise<{ success: boolean; message: string; googleEmail: string }> {
    return this.request('/api/google/simulate-auth', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async disconnectGoogle(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/google/disconnect', { method: 'POST' });
  }

  async syncGoogleCalendar(): Promise<{ success: boolean; count: number; events: SyncedCalendarEvent[] }> {
    return this.request('/api/google/sync', { method: 'POST' });
  }

  async getGoogleEvents(): Promise<SyncedCalendarEvent[]> {
    const data = await this.request<{ events: SyncedCalendarEvent[] }>('/api/google/events');
    return data.events;
  }

  // ---------------- AI CHAT ---------------- //
  async sendAIChatMessage(message: string, history: ChatMessage[]): Promise<{
    reply: string;
    toolExecutions: { name: string; args: any; result: any }[];
  }> {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history })
    });
  }

  // ---------------- ADMIN GEMINI KEY ---------------- //
  async getGeminiAdminConfig(): Promise<GeminiAdminConfig> {
    return this.request('/api/admin/gemini-config');
  }

  async updateGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string; source: string; model?: string }> {
    return this.request('/api/admin/gemini-config', {
      method: 'POST',
      body: JSON.stringify({ apiKey })
    });
  }

  async updateGeminiModel(model: string): Promise<{ success: boolean; message: string; source: string; model: string }> {
    return this.request('/api/admin/gemini-config', {
      method: 'POST',
      body: JSON.stringify({ model })
    });
  }

  async testGeminiConnection(): Promise<{ success: boolean; model: string; testResponse: string; timestamp: string }> {
    return this.request('/api/admin/test-gemini', {
      method: 'POST'
    });
  }

  // ---------------- ADMIN DATABASE & FIREBASE PERSISTENCE ---------------- //
  async getDatabaseStatus(): Promise<DatabaseStatusInfo> {
    return this.request('/api/admin/database-status');
  }

  async syncAllCalendars(): Promise<{ success: boolean; syncedCount: number; errors: number; lastPeriodicSync: string }> {
    return this.request('/api/admin/sync-all-calendars', {
      method: 'POST'
    });
  }
}

export const api = new ApiClient();
