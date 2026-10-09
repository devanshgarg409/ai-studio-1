import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbStore, verifyPassword, hashPassword } from './server/db';
import { googleService } from './server/googleService';
import { processAIChat } from './server/aiAgent';
import { Appointment, User } from './src/types';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Helper to determine accurate public origin (ensuring HTTPS on Cloud Run / external proxies)
function getAppOrigin(req: Request): string {
  const rawProto = req.headers['x-forwarded-proto'];
  let forwardedProto = '';
  if (Array.isArray(rawProto)) {
    forwardedProto = rawProto[0] || '';
  } else if (typeof rawProto === 'string') {
    forwardedProto = rawProto.split(',')[0].trim();
  }

  const host = (req.headers['x-forwarded-host'] || req.get('host') || '') as string;
  const referer = (req.headers['referer'] || req.headers['origin'] || '') as string;

  // Enforce HTTPS if:
  // 1. Explicitly forwarded as https (or begins with https)
  // 2. The client browser came via HTTPS (Referer or Origin starts with https://)
  // 3. Hosted on Cloud Run (*.run.app) or any external non-localhost host
  // 4. req.protocol is https
  let protocol = 'http';
  if (
    forwardedProto.toLowerCase() === 'https' ||
    req.protocol === 'https' ||
    referer.startsWith('https://') ||
    host.includes('.run.app') ||
    (!host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('0.0.0.0'))
  ) {
    protocol = 'https';
  }

  return `${protocol}://${host}`;
}

// Helper to get authenticated user from request header
function getAuthUser(req: Request): User | null {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return null;
  const user = dbStore.users.get(userId);
  if (!user || user.disabled) return null;
  return user;
}

// ---------------- AUTH & LOGIN ROUTES ---------------- //
// Requirement 1: Login Page authentication
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please provide both User ID and Password.' });
  }

  const user = dbStore.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid User ID or Password.' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: 'This account has been disabled by the Administrator. Please contact support.' });
  }

  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid User ID or Password.' });
  }

  // Return clean user object without password hash
  const { passwordHash: _, ...safeUser } = user;
  res.json({
    success: true,
    user: safeUser
  });
});

app.get('/api/users/current', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// ---------------- ADMIN PROFILE MANAGEMENT (REQUIREMENT 2) ---------------- //
// Admin: View Student profiles
app.get('/api/admin/students', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  const students = Array.from(dbStore.students.values());
  res.json({ students });
});

// Admin: Create Student profile
app.post('/api/admin/students', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { username, password, name, email, department, studentId, phone } = req.body;

  if (!username || !password || !name || !email || !studentId) {
    return res.status(400).json({ error: 'Missing required student fields (User ID, Password, Name, Email, Student ID).' });
  }

  try {
    const { student } = dbStore.createStudent({
      username,
      password,
      name,
      email,
      department: department || 'Computer Science',
      studentId,
      phone
    });
    res.status(201).json({ student });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Edit Student profile
app.put('/api/admin/students/:id', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const student = dbStore.students.get(id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const { name, email, department, studentId, phone, password } = req.body;
  if (name !== undefined) student.name = name;
  if (email !== undefined) student.email = email;
  if (department !== undefined) student.department = department;
  if (studentId !== undefined) student.studentId = studentId;
  if (phone !== undefined) student.phone = phone;
  student.updatedAt = new Date().toISOString();

  // Update associated user record
  const user = dbStore.users.get(student.userId);
  if (user) {
    if (name !== undefined) user.displayName = name;
    if (email !== undefined) user.email = email;
    if (department !== undefined) user.department = department;
    if (studentId !== undefined) user.studentId = studentId;
    if (phone !== undefined) user.phone = phone;
    if (password && password.trim().length > 0) {
      user.passwordHash = hashPassword(password);
    }
    user.updatedAt = student.updatedAt;
    dbStore.users.set(user.id, user);
  }

  dbStore.students.set(id, student);
  res.json({ student });
});

// Admin: Disable / Toggle status Student profile
app.patch('/api/admin/students/:id/status', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const student = dbStore.students.get(id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const { disabled } = req.body;
  student.disabled = !!disabled;
  student.updatedAt = new Date().toISOString();

  const user = dbStore.users.get(student.userId);
  if (user) {
    user.disabled = student.disabled;
    dbStore.users.set(user.id, user);
  }

  dbStore.students.set(id, student);
  res.json({ student });
});

// Admin: Delete Student profile
app.delete('/api/admin/students/:id', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const student = dbStore.students.get(id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  dbStore.users.delete(student.userId);
  dbStore.students.delete(id);
  res.json({ success: true, message: 'Student profile deleted.' });
});

// Admin: View Faculty profiles
app.get('/api/admin/faculty', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  const faculty = Array.from(dbStore.facultyProfiles.values()).map(f => ({
    ...f,
    isGoogleConnected: googleService.isUserCalendarConnected(f.userId)
  }));
  res.json({ faculty });
});

// Admin: Create Faculty profile
app.post('/api/admin/faculty', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { username, password, name, email, department, title, officeLocation, bio } = req.body;

  if (!username || !password || !name || !email || !title) {
    return res.status(400).json({ error: 'Missing required faculty fields (User ID, Password, Name, Email, Title).' });
  }

  try {
    const { faculty } = dbStore.createFaculty({
      username,
      password,
      name,
      email,
      department: department || 'Academic Department',
      title,
      officeLocation,
      bio
    });
    res.status(201).json({ faculty });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Edit Faculty profile
app.put('/api/admin/faculty/:id', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const faculty = dbStore.facultyProfiles.get(id);
  if (!faculty) {
    return res.status(404).json({ error: 'Faculty profile not found.' });
  }

  const { name, email, department, title, officeLocation, bio, password } = req.body;
  if (name !== undefined) faculty.name = name;
  if (email !== undefined) faculty.email = email;
  if (department !== undefined) faculty.department = department;
  if (title !== undefined) faculty.title = title;
  if (officeLocation !== undefined) faculty.officeLocation = officeLocation;
  if (bio !== undefined) faculty.bio = bio;
  faculty.updatedAt = new Date().toISOString();

  // Update associated user record
  const user = dbStore.users.get(faculty.userId);
  if (user) {
    if (name !== undefined) user.displayName = name;
    if (email !== undefined) user.email = email;
    if (department !== undefined) user.department = department;
    if (title !== undefined) user.title = title;
    if (password && password.trim().length > 0) {
      user.passwordHash = hashPassword(password);
    }
    user.updatedAt = faculty.updatedAt;
    dbStore.users.set(user.id, user);
  }

  dbStore.facultyProfiles.set(id, faculty);
  res.json({ faculty });
});

// Admin: Disable / Toggle status Faculty profile
app.patch('/api/admin/faculty/:id/status', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const faculty = dbStore.facultyProfiles.get(id);
  if (!faculty) {
    return res.status(404).json({ error: 'Faculty profile not found.' });
  }

  const { disabled } = req.body;
  faculty.disabled = !!disabled;
  faculty.updatedAt = new Date().toISOString();

  const user = dbStore.users.get(faculty.userId);
  if (user) {
    user.disabled = faculty.disabled;
    dbStore.users.set(user.id, user);
  }

  dbStore.facultyProfiles.set(id, faculty);
  res.json({ faculty });
});

// Admin: Delete Faculty profile
app.delete('/api/admin/faculty/:id', (req: Request, res: Response) => {
  const admin = getAuthUser(req);
  if (admin?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  const { id } = req.params;
  const faculty = dbStore.facultyProfiles.get(id);
  if (!faculty) {
    return res.status(404).json({ error: 'Faculty profile not found.' });
  }

  dbStore.users.delete(faculty.userId);
  dbStore.facultyProfiles.delete(id);
  res.json({ success: true, message: 'Faculty profile deleted.' });
});

// ---------------- FACULTY DIRECTORY & GOOGLE AVAILABILITY (REQUIREMENTS 3, 4, 6) ---------------- //
app.get('/api/faculty', (_req: Request, res: Response) => {
  const faculty = Array.from(dbStore.facultyProfiles.values())
    .filter(f => !f.disabled)
    .map(f => ({
      ...f,
      isGoogleConnected: googleService.isUserCalendarConnected(f.userId)
    }));
  res.json({ faculty });
});

// Get Faculty Available Slots: Strictly from Google Calendar between 9:00 AM and 4:00 PM
app.get('/api/faculty/:id/availability', async (req: Request, res: Response) => {
  const { id } = req.params;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

  try {
    const availability = await googleService.getFacultyAvailableSlots(id, date);
    res.json(availability);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- APPOINTMENT ROUTES (REQUIREMENTS 4 & 6) ---------------- //
app.get('/api/appointments', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  let appointments = Array.from(dbStore.appointments.values());

  if (user.role === 'STUDENT') {
    appointments = appointments.filter(a => a.studentId === user.id);
  } else if (user.role === 'FACULTY') {
    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === user.id);
    if (faculty) {
      appointments = appointments.filter(a => a.facultyId === faculty.id);
    } else {
      appointments = [];
    }
  }
  // Admin sees all

  appointments.sort((a, b) => new Date(`${b.date}T${b.startTime}`).getTime() - new Date(`${a.date}T${a.startTime}`).getTime());
  res.json({ appointments });
});

// Create Appointment: Re-checks Google Calendar before booking
app.post('/api/appointments', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (user.role !== 'STUDENT' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only students or administrators can create appointment requests.' });
  }

  const { facultyId, date, startTime, endTime, purpose, notes } = req.body;

  if (!facultyId || !date || !startTime || !endTime || !purpose) {
    return res.status(400).json({ error: 'Missing required appointment fields.' });
  }

  const faculty = dbStore.facultyProfiles.get(facultyId);
  if (!faculty || faculty.disabled) {
    return res.status(404).json({ error: 'Faculty member not found or inactive.' });
  }

  // Requirement 4 & 6: Re-check Google Calendar availability before booking
  const check = await googleService.checkFacultySlotAvailable(faculty.id, date, startTime, endTime);
  if (!check.available) {
    return res.status(400).json({ error: check.reason });
  }

  const appointmentId = `apt-${Date.now().toString().slice(-6)}`;
  const appointment: Appointment = {
    id: appointmentId,
    studentId: user.id,
    studentName: user.displayName,
    studentEmail: user.email,
    facultyId: faculty.id,
    facultyName: faculty.name,
    facultyEmail: faculty.email,
    date,
    startTime,
    endTime,
    purpose,
    notes: notes || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  dbStore.appointments.set(appointmentId, appointment);

  // Sync to Google Calendar
  try {
    const googleEventId = await googleService.addAppointmentToCalendar(faculty.userId, appointment);
    if (googleEventId) {
      appointment.googleCalendarEventId = googleEventId;
      dbStore.appointments.set(appointmentId, appointment);
    }
  } catch (err: any) {
    console.warn('Could not add appointment to Google Calendar:', err.message);
  }

  res.status(201).json({ appointment });
});

app.patch('/api/appointments/:id/status', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  const apt = dbStore.appointments.get(id);
  if (!apt) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (user.role === 'STUDENT') {
    if (apt.studentId !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only cancel your own appointments.' });
    }
    if (status !== 'cancelled') {
      return res.status(403).json({ error: 'Students can only cancel appointments.' });
    }
  } else if (user.role === 'FACULTY') {
    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === user.id);
    if (!faculty || faculty.id !== apt.facultyId) {
      return res.status(403).json({ error: 'Access denied: You are not the assigned faculty member.' });
    }
  }

  apt.status = status;
  apt.updatedAt = new Date().toISOString();
  if (rejectionReason) {
    apt.rejectionReason = rejectionReason;
  }

  // TWO-WAY SYNC: Update Google Calendar whenever appointment is confirmed/accepted or cancelled/rejected
  const targetFaculty = dbStore.facultyProfiles.get(apt.facultyId);
  if (targetFaculty) {
    try {
      if (status === 'accepted' || status === 'confirmed') {
        const calEventId = await googleService.updateAppointmentInCalendar(targetFaculty.userId, apt);
        if (calEventId) {
          apt.googleCalendarEventId = calEventId;
        }
      } else if (status === 'cancelled' || status === 'rejected') {
        if (apt.googleCalendarEventId) {
          await googleService.deleteAppointmentFromCalendar(targetFaculty.userId, apt.googleCalendarEventId);
          apt.googleCalendarEventId = undefined;
        }
      }
    } catch (err: any) {
      console.warn(`[Two-Way Sync] Could not sync appointment status ${status} to Google Calendar:`, err.message);
    }
  }

  dbStore.appointments.set(id, apt);
  res.json({ appointment: apt });
});

// ---------------- GOOGLE INTEGRATION ROUTES ---------------- //
app.post('/api/google/upload-config', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { configData } = req.body;
  if (!configData) {
    return res.status(400).json({ error: 'No credential configuration data provided.' });
  }

  try {
    const raw = typeof configData === 'string' ? JSON.parse(configData) : configData;
    const result = googleService.saveUserConfig(user.id, raw);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to parse Google credentials JSON.' });
  }
});

app.get('/api/google/status', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const status = googleService.getUserStatus(user.id);
  res.json({ status, user: { id: user.id, email: user.email, name: user.displayName } });
});

app.get('/api/google/auth-url', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const appOrigin = getAppOrigin(req);

  try {
    const authUrl = googleService.getAuthUrl(user.id, appOrigin);
    res.json({ authUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    return res.send(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2 style="color: #ef4444;">Authorization Cancelled or Failed</h2>
        <a href="/">Return to Dashboard</a>
      </body></html>
    `);
  }

  try {
    const stateObj = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    const origin = stateObj.origin || getAppOrigin(req);
    await googleService.handleCallback(code as string, stateObj.userId, origin);
    res.send(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center; background: #f8fafc;">
        <div style="max-width: 500px; margin: 40px auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="font-size: 48px; color: #10b981; margin-bottom: 16px;">✓</div>
          <h2>Google Calendar Connected!</h2>
          <p style="color: #64748b;">Your Google Account has been authorized. Working hours (9:00 AM – 4:00 PM) availability is synced.</p>
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Back to Dashboard</a>
        </div>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          }, 1500);
        </script>
      </body></html>
    `);
  } catch (err: any) {
    res.status(500).send(`<h3>Authorization Error: ${err.message}</h3><a href="/">Back</a>`);
  }
});

app.post('/api/google/simulate-auth', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { email } = req.body;
  const token = googleService.simulateAuthorization(user.id, email || user.email);
  res.json({
    success: true,
    message: 'Google Calendar connected successfully in sandbox environment.',
    googleEmail: token.google_email
  });
});

app.post('/api/google/disconnect', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  googleService.disconnectUser(user.id);
  res.json({ success: true, message: 'Google account disconnected.' });
});

app.post('/api/google/sync', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const events = await googleService.syncUserCalendar(user.id);
    let appointments = Array.from(dbStore.appointments.values());
    if (user.role === 'STUDENT') {
      appointments = appointments.filter(a => a.studentId === user.id);
    } else if (user.role === 'FACULTY') {
      const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === user.id);
      if (faculty) {
        appointments = appointments.filter(a => a.facultyId === faculty.id);
      }
    }
    res.json({ success: true, count: events.length, events, appointments });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sync Google Calendar' });
  }
});

app.get('/api/google/events', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const events = dbStore.calendarEvents.get(user.id) || [];
  res.json({ events });
});

// ---------------- AI ASSISTANT (REQUIREMENT 7) ---------------- //
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const result = await processAIChat(user.id, message, history || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI Chat processing failed' });
  }
});

// ---------------- ADMIN GEMINI API KEY & MODEL (ADMIN ONLY) ---------------- //
app.get('/api/admin/gemini-config', (req: Request, res: Response) => {
  const activeKey = dbStore.customGeminiApiKey || process.env.GEMINI_API_KEY || '';
  const maskedKey = activeKey.length > 8
    ? `${activeKey.substring(0, 4)}...${activeKey.substring(activeKey.length - 4)}`
    : (activeKey ? '***' : 'Not Configured');

  const availableModels = [
    { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 E4B (26B A4B IT) - Default' },
    { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT (Large Gemma Instruction Tuned)' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Flagship Fast Multimodal)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High Throughput Low Latency)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning & STEM)' }
  ];

  res.json({
    source: dbStore.customGeminiApiKey ? 'custom' : (process.env.GEMINI_API_KEY ? 'env' : 'none'),
    isConfigured: !!activeKey,
    maskedKey,
    model: dbStore.llmModel || 'gemma-4-26b-a4b-it',
    availableModels,
    status: activeKey ? 'operational' : 'unconfigured',
    lastPeriodicSync: dbStore.lastPeriodicSync
  });
});

app.post('/api/admin/gemini-config', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators have the right to update the LLM configuration.' });
  }

  const { apiKey, model } = req.body;

  if (model && typeof model === 'string' && model.trim().length > 0) {
    const raw = model.trim();
    if (raw === 'gemma 4 e4b' || raw === 'gemma-4-e4b' || raw === 'gemma 4') {
      dbStore.llmModel = 'gemma-4-26b-a4b-it';
    } else {
      dbStore.llmModel = raw;
    }
  }

  if (apiKey !== undefined) {
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      dbStore.customGeminiApiKey = '';
    } else {
      dbStore.customGeminiApiKey = apiKey.trim();
    }
  }

  res.json({
    success: true,
    message: 'LLM Configuration updated successfully by Administrator.',
    source: dbStore.customGeminiApiKey ? 'custom' : 'env',
    model: dbStore.llmModel || 'gemma-4-26b-a4b-it'
  });
});

app.post('/api/admin/test-gemini', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can test the LLM connection.' });
  }

  const apiKey = dbStore.customGeminiApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return res.status(400).json({ error: 'No Gemini/Gemma API key is currently configured.' });
  }

  const targetModel = dbStore.llmModel || 'gemma-4-26b-a4b-it';

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: 'Ping test: respond with "LLM Operational"'
    });

    res.json({
      success: true,
      model: targetModel,
      testResponse: response.text || 'LLM Operational',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || `Test failed with model ${targetModel}` });
  }
});

// ---------------- ADMIN DATABASE & FIREBASE PERSISTENCE STATUS ---------------- //
app.get('/api/admin/database-status', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }

  let totalCalendarEvents = 0;
  for (const evts of dbStore.calendarEvents.values()) {
    totalCalendarEvents += evts.length;
  }

  let projectId = 'gen-lang-client-0499327347';
  let firestoreDatabaseId = 'ai-studio-5f918953-2b5a-44bc-afa3-ce6f8b245f41';
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      projectId = parsed.projectId || projectId;
      firestoreDatabaseId = parsed.firestoreDatabaseId || firestoreDatabaseId;
    }
  } catch {}

  const facultyList = Array.from(dbStore.facultyProfiles.values());
  const syncedFaculty = facultyList.map(f => {
    const isConn = googleService.isUserCalendarConnected(f.userId);
    const evts = dbStore.calendarEvents.get(f.userId) || [];
    return {
      facultyId: f.id,
      facultyName: f.name,
      userId: f.userId,
      isGoogleConnected: isConn,
      googleEmail: f.googleEmail,
      eventsCount: evts.length,
      lastSyncedAt: evts.length > 0 ? evts[0].syncedAt : undefined,
      events: evts
    };
  });

  res.json({
    status: 'connected',
    projectId,
    firestoreDatabaseId,
    counts: {
      users: dbStore.users.size,
      students: dbStore.students.size,
      faculty: dbStore.facultyProfiles.size,
      appointments: dbStore.appointments.size,
      googleConfigs: dbStore.googleConfigs.size,
      googleTokens: dbStore.googleTokens.size,
      syncedCalendarEvents: totalCalendarEvents
    },
    llmModel: dbStore.llmModel || 'gemma-4-26b-a4b-it',
    hasCustomGeminiApiKey: Boolean(dbStore.customGeminiApiKey),
    lastPeriodicSync: dbStore.lastPeriodicSync,
    syncedFaculty
  });
});

app.post('/api/admin/sync-all-calendars', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }

  try {
    const result = await googleService.periodicSyncAllUsers();
    res.json({
      success: true,
      syncedCount: result.syncedCount,
      errors: result.errors,
      lastPeriodicSync: dbStore.lastPeriodicSync
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Manual calendar sync failed.' });
  }
});

// Periodic Google Calendar Sync every 30 minutes (Requirement 5)
const PERIODIC_SYNC_INTERVAL_MS = 30 * 60 * 1000;
setInterval(() => {
  console.log('[Scheduler] Running 30-minute periodic Google Calendar sync...');
  googleService.periodicSyncAllUsers().catch(err => {
    console.error('[Scheduler] Periodic calendar sync failed:', err);
  });
}, PERIODIC_SYNC_INTERVAL_MS);

// ---------------- VITE / STATIC SERVING ---------------- //
const PORT = 3000;

async function startServer() {
  // Hydrate persistent database from Firebase Firestore
  await dbStore.init();

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AcademiaSync] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
