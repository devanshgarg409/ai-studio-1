import { google } from 'googleapis';
import { dbStore, UserTokenData } from './db';
import { GoogleClientConfig, SyncedCalendarEvent, Appointment, FacultyAvailabilityResponse, TimeSlot } from '../src/types';

export class GoogleIntegrationService {
  private userTimeZones: Map<string, string> = new Map();

  /**
   * Fetch primary calendar time zone from Google Calendar API
   */
  async getCalendarTimeZone(userId: string, preferredTz?: string): Promise<string> {
    if (preferredTz) {
      this.userTimeZones.set(userId, preferredTz);
      return preferredTz;
    }

    if (this.userTimeZones.has(userId)) {
      return this.userTimeZones.get(userId)!;
    }

    const token = dbStore.googleTokens.get(userId);
    if (!token || token.access_token.startsWith('mock_')) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      this.userTimeZones.set(userId, tz);
      return tz;
    }

    try {
      const auth = this.getAuthorizedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });
      const res = await calendar.calendars.get({ calendarId: 'primary' });
      const tz = res.data.timeZone || 'Asia/Kolkata';
      this.userTimeZones.set(userId, tz);
      return tz;
    } catch (err: any) {
      console.warn(`Could not get primary calendar timezone for user ${userId}:`, err.message);
      return 'Asia/Kolkata';
    }
  }

  /**
   * Produce an exact RFC3339 formatted date-time string with time zone offset
   * preventing Google Calendar from shifting local 9:00 AM to 3:00 PM / UTC conversions.
   */
  formatRFC3339(dateStr: string, timeStr: string, timeZone: string): string {
    try {
      const d = new Date(`${dateStr}T${timeStr}:00Z`);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      let offset = '+00:00';
      if (tzPart && tzPart.value) {
        if (tzPart.value === 'GMT') {
          offset = '+00:00';
        } else {
          offset = tzPart.value.replace('GMT', '');
        }
      }
      return `${dateStr}T${timeStr}:00${offset}`;
    } catch {
      return `${dateStr}T${timeStr}:00`;
    }
  }

  /**
   * Save uploaded Google Client credentials JSON for a specific user
   */
  saveUserConfig(userId: string, rawConfig: any): { success: boolean; clientIdMasked: string; message: string } {
    let clientId = '';
    let clientSecret = '';
    let projectId = '';
    let authUri = 'https://accounts.google.com/o/oauth2/auth';
    let tokenUri = 'https://oauth2.googleapis.com/token';
    let redirectUris: string[] = [];

    if (rawConfig.installed) {
      clientId = rawConfig.installed.client_id;
      clientSecret = rawConfig.installed.client_secret;
      projectId = rawConfig.installed.project_id;
      authUri = rawConfig.installed.auth_uri || authUri;
      tokenUri = rawConfig.installed.token_uri || tokenUri;
      redirectUris = rawConfig.installed.redirect_uris || [];
    } else if (rawConfig.web) {
      clientId = rawConfig.web.client_id;
      clientSecret = rawConfig.web.client_secret;
      projectId = rawConfig.web.project_id;
      authUri = rawConfig.web.auth_uri || authUri;
      tokenUri = rawConfig.web.token_uri || tokenUri;
      redirectUris = rawConfig.web.redirect_uris || [];
    } else if (rawConfig.client_id && rawConfig.client_secret) {
      clientId = rawConfig.client_id;
      clientSecret = rawConfig.client_secret;
      projectId = rawConfig.project_id;
      redirectUris = rawConfig.redirect_uris || [];
    }

    if (!clientId || !clientSecret) {
      throw new Error('Invalid Google credentials JSON. Missing client_id or client_secret.');
    }

    const config: GoogleClientConfig = {
      client_id: clientId,
      client_secret: clientSecret,
      project_id: projectId,
      auth_uri: authUri,
      token_uri: tokenUri,
      redirect_uris: redirectUris
    };

    dbStore.googleConfigs.set(userId, config);

    const masked = clientId.length > 12 
      ? `${clientId.substring(0, 8)}...${clientId.substring(clientId.length - 8)}`
      : '***';

    return {
      success: true,
      clientIdMasked: masked,
      message: 'Google OAuth Client credentials stored successfully for your account.'
    };
  }

  /**
   * Remove credentials and tokens for a user
   */
  disconnectUser(userId: string) {
    dbStore.googleConfigs.delete(userId);
    dbStore.googleTokens.delete(userId);
    dbStore.calendarEvents.delete(userId);
    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === userId);
    if (faculty) {
      faculty.isGoogleConnected = false;
      faculty.googleEmail = '';
      dbStore.facultyProfiles.set(faculty.id, faculty);
    }
  }

  /**
   * Check if a specific user has their Google Calendar authorized
   */
  isUserCalendarConnected(userId: string): boolean {
    const token = dbStore.googleTokens.get(userId);
    return !!(token && (token.refresh_token || token.access_token));
  }

  /**
   * Get current Google integration status for a user
   */
  getUserStatus(userId: string) {
    const config = dbStore.googleConfigs.get(userId);
    const token = dbStore.googleTokens.get(userId);
    const events = dbStore.calendarEvents.get(userId) || [];

    const clientIdMasked = config?.client_id 
      ? (config.client_id.length > 14 
          ? `${config.client_id.substring(0, 8)}...${config.client_id.substring(config.client_id.length - 8)}`
          : '***')
      : undefined;

    return {
      hasCredentials: !!config,
      clientIdMasked,
      isAuthorized: !!(token && (token.refresh_token || token.access_token)),
      googleEmail: token?.google_email,
      expiryDate: token?.expiry_date,
      syncedEventsCount: events.length,
      lastSyncedAt: events[0]?.syncedAt
    };
  }

  /**
   * Helper to normalize origin, ensuring HTTPS for Cloud Run or external domains
   */
  private normalizeOrigin(appOrigin: string): string {
    if (!appOrigin) return '';
    if (appOrigin.includes('.run.app') && appOrigin.startsWith('http://')) {
      return appOrigin.replace('http://', 'https://');
    }
    return appOrigin;
  }

  /**
   * Generate OAuth Authorization URL for the user
   */
  getAuthUrl(userId: string, appOrigin: string): string {
    const config = dbStore.googleConfigs.get(userId);
    if (!config) {
      throw new Error('No Google credentials JSON uploaded for this user. Please upload credentials first.');
    }

    const cleanOrigin = this.normalizeOrigin(appOrigin);
    const redirectUri = `${cleanOrigin}/api/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const state = Buffer.from(JSON.stringify({ userId, origin: cleanOrigin })).toString('base64');

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state
    });
  }

  /**
   * Exchange Google auth code for tokens
   */
  async handleCallback(code: string, userId: string, appOrigin: string): Promise<UserTokenData> {
    const config = dbStore.googleConfigs.get(userId);
    if (!config) {
      throw new Error(`Google OAuth config not found for user ${userId}`);
    }

    const cleanOrigin = this.normalizeOrigin(appOrigin);
    const redirectUri = `${cleanOrigin}/api/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let googleEmail = '';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userinfo = await oauth2.userinfo.get();
      googleEmail = userinfo.data.email || '';
    } catch {
      try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const cal = await calendar.calendars.get({ calendarId: 'primary' });
        googleEmail = cal.data.id || '';
      } catch (err) {
        console.warn('Could not fetch email profile:', err);
      }
    }

    const existingToken = dbStore.googleTokens.get(userId);
    const tokenData: UserTokenData = {
      access_token: tokens.access_token || existingToken?.access_token || '',
      refresh_token: tokens.refresh_token || existingToken?.refresh_token,
      expiry_date: tokens.expiry_date || undefined,
      scope: tokens.scope || undefined,
      google_email: googleEmail || existingToken?.google_email || 'authorized_user@gmail.com'
    };

    dbStore.googleTokens.set(userId, tokenData);

    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === userId);
    if (faculty) {
      faculty.isGoogleConnected = true;
      faculty.googleEmail = tokenData.google_email;
      dbStore.facultyProfiles.set(faculty.id, faculty);
    }

    // Initial calendar sync immediately
    await this.syncUserCalendar(userId).catch(err => {
      console.warn('Initial calendar sync skipped/deferred:', err.message);
    });

    return tokenData;
  }

  /**
   * Set simulated authorization for testing / sandbox demo
   */
  simulateAuthorization(userId: string, email: string): UserTokenData {
    const user = dbStore.users.get(userId);
    const tokenData: UserTokenData = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expiry_date: Date.now() + 3600 * 1000,
      scope: 'https://www.googleapis.com/auth/calendar',
      google_email: email || user?.email || 'faculty.google@institution.edu'
    };

    dbStore.googleTokens.set(userId, tokenData);

    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === userId);
    if (faculty) {
      faculty.isGoogleConnected = true;
      faculty.googleEmail = tokenData.google_email;
      dbStore.facultyProfiles.set(faculty.id, faculty);
    }

    // Seed realistic Google Calendar conflict events during the day
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const mockEvents: SyncedCalendarEvent[] = [
      {
        id: `mock-cal-${Date.now()}-1`,
        userId,
        googleEventId: `gevent-seed-1`,
        summary: 'Departmental Faculty Meeting',
        description: 'Weekly academic curriculum review',
        start: `${todayStr}T11:00:00`,
        end: `${todayStr}T12:00:00`,
        location: 'Senate Hall',
        isAppointment: false,
        syncedAt: new Date().toISOString()
      },
      {
        id: `mock-cal-${Date.now()}-2`,
        userId,
        googleEventId: `gevent-seed-2`,
        summary: 'Undergraduate Lecture CS301',
        description: 'Lecture and lab coordination',
        start: `${todayStr}T13:30:00`,
        end: `${todayStr}T14:30:00`,
        location: 'Lecture Hall B',
        isAppointment: false,
        syncedAt: new Date().toISOString()
      }
    ];

    dbStore.calendarEvents.set(userId, mockEvents);
    return tokenData;
  }

  /**
   * Get an authorized OAuth2 client for an individual user
   */
  private getAuthorizedClient(userId: string) {
    const config = dbStore.googleConfigs.get(userId);
    const token = dbStore.googleTokens.get(userId);

    if (!config || !token) {
      throw new Error(`User ${userId} has not authorized Google Calendar.`);
    }

    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret
    );

    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: token.expiry_date
    });

    oauth2Client.on('tokens', (newTokens) => {
      const current = dbStore.googleTokens.get(userId);
      if (current) {
        current.access_token = newTokens.access_token || current.access_token;
        if (newTokens.refresh_token) {
          current.refresh_token = newTokens.refresh_token;
        }
        current.expiry_date = newTokens.expiry_date || current.expiry_date;
        dbStore.googleTokens.set(userId, current);
      }
    });

    return oauth2Client;
  }

  /**
   * Sync Google Calendar events for an individual user into database (Two-Way Sync: Google Calendar -> App)
   */
  async syncUserCalendar(userId: string): Promise<SyncedCalendarEvent[]> {
    const token = dbStore.googleTokens.get(userId);
    if (!token) {
      return [];
    }

    let syncedEvents: SyncedCalendarEvent[] = [];
    const activeGoogleEventIds = new Set<string>();

    // Check if simulated
    if (token.access_token.startsWith('mock_')) {
      const existing = dbStore.calendarEvents.get(userId) || [];
      syncedEvents = existing.map(e => ({ ...e, syncedAt: new Date().toISOString() }));
      dbStore.calendarEvents.set(userId, syncedEvents);
      syncedEvents.forEach(e => {
        if (e.googleEventId) activeGoogleEventIds.add(e.googleEventId);
      });
    } else {
      try {
        const timeZone = await this.getCalendarTimeZone(userId);
        const auth = this.getAuthorizedClient(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        const timeMin = new Date(Date.now() - 86400000 * 7).toISOString();
        const timeMax = new Date(Date.now() + 86400000 * 30).toISOString();

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          timeZone: timeZone,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250
        });

        const items = response.data.items || [];
        // Filter out cancelled events
        const activeItems = items.filter(item => item.status !== 'cancelled');

        syncedEvents = activeItems.map((item) => {
          if (item.id) activeGoogleEventIds.add(item.id);
          return {
            id: `gevent-${item.id}`,
            userId,
            googleEventId: item.id || undefined,
            summary: item.summary || 'Scheduled Calendar Event',
            description: item.description || undefined,
            start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
            end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
            location: item.location || undefined,
            htmlLink: item.htmlLink || undefined,
            isAppointment: item.summary?.toLowerCase().includes('appointment') || false,
            syncedAt: new Date().toISOString()
          };
        });

        dbStore.calendarEvents.set(userId, syncedEvents);
      } catch (err: any) {
        console.error(`Error syncing calendar for user ${userId}:`, err.message);
        throw err;
      }
    }

    // Two-Way Sync (Google Calendar -> App):
    // If an appointment was previously synced to Google Calendar but is now deleted or cancelled in Google Calendar,
    // update the application appointment to reflect the cancellation.
    const faculty = Array.from(dbStore.facultyProfiles.values()).find(f => f.userId === userId);
    if (faculty) {
      const appointments = Array.from(dbStore.appointments.values()).filter(
        a => a.facultyId === faculty.id && a.googleCalendarEventId
      );

      for (const apt of appointments) {
        if (
          (apt.status === 'pending' || apt.status === 'accepted') &&
          apt.googleCalendarEventId &&
          !activeGoogleEventIds.has(apt.googleCalendarEventId)
        ) {
          console.log(`[Two-Way Sync] Appointment ${apt.id} deleted from Google Calendar. Updating app appointment status.`);
          apt.status = 'cancelled';
          apt.rejectionReason = 'Cancelled directly in Google Calendar';
          apt.updatedAt = new Date().toISOString();
          dbStore.appointments.set(apt.id, apt);
        }
      }
    }

    return syncedEvents;
  }

  /**
   * Determine available slots between 9:00 AM and 4:00 PM strictly from Google Calendar
   * Requirements 3, 4, 6:
   * - Working hours: 9:00 AM - 4:00 PM (09:00 - 16:00)
   * - Google Calendar is the ONLY source of truth for individual availability.
   * - If not connected: do not allow booking, return specific message.
   */
  async getFacultyAvailableSlots(facultyId: string, date: string): Promise<FacultyAvailabilityResponse> {
    const faculty = dbStore.facultyProfiles.get(facultyId);
    if (!faculty) {
      throw new Error(`Faculty profile not found for ID: ${facultyId}`);
    }

    const isConnected = this.isUserCalendarConnected(faculty.userId);

    if (!isConnected) {
      return {
        facultyId: faculty.id,
        facultyName: faculty.name,
        date,
        isConnected: false,
        message: "Google Account Not Linked\n\nKindly contact the faculty personally to schedule an appointment.",
        workingHours: "9:00 AM – 4:00 PM",
        slots: []
      };
    }

    const timeZone = await this.getCalendarTimeZone(faculty.userId);

    // Retrieve events from Google Calendar
    let events: SyncedCalendarEvent[] = [];
    try {
      events = await this.syncUserCalendar(faculty.userId);
    } catch {
      events = dbStore.calendarEvents.get(faculty.userId) || [];
    }

    // Helper to parse event date and minutes of day in faculty calendar timezone
    const parseLocalTime = (dateOrDateTimeStr: string, tz: string) => {
      if (!dateOrDateTimeStr) return { date: '', minutes: 0, isAllDay: false };
      // All-day event (YYYY-MM-DD)
      if (!dateOrDateTimeStr.includes('T')) {
        return { date: dateOrDateTimeStr, minutes: 0, isAllDay: true };
      }

      try {
        const d = new Date(dateOrDateTimeStr);
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(d);
        const y = parts.find(p => p.type === 'year')?.value || '';
        const m = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
        const min = Number(parts.find(p => p.type === 'minute')?.value || 0);
        return {
          date: `${y}-${m}-${day}`,
          minutes: hour * 60 + min,
          isAllDay: false
        };
      } catch {
        const [dPart, tPart] = dateOrDateTimeStr.split('T');
        const [h, m] = (tPart || '00:00').substring(0, 5).split(':').map(Number);
        return { date: dPart, minutes: (h || 0) * 60 + (m || 0), isAllDay: false };
      }
    };

    // Also get active database appointments for this faculty on this date
    const bookedAppointments = Array.from(dbStore.appointments.values()).filter(
      apt => apt.facultyId === faculty.id &&
             apt.date === date &&
             apt.status !== 'cancelled' &&
             apt.status !== 'rejected'
    );

    // Working hours: 9:00 AM to 4:00 PM (09:00 to 16:00)
    // Build 30-minute standard slot intervals
    const candidateSlots: TimeSlot[] = [];
    for (let hour = 9; hour < 16; hour++) {
      const hStr = hour.toString().padStart(2, '0');
      candidateSlots.push({ startTime: `${hStr}:00`, endTime: `${hStr}:30` });
      candidateSlots.push({ startTime: `${hStr}:30`, endTime: `${(hour + 1).toString().padStart(2, '0')}:00` });
    }

    // Convert time HH:MM to minute of day
    const toMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // Filter slots that do not collide with Google Calendar events or confirmed appointments
    const availableSlots = candidateSlots.filter(slot => {
      const slotStartMin = toMinutes(slot.startTime);
      const slotEndMin = toMinutes(slot.endTime);

      // Check Google Calendar events collision in the faculty's local timezone
      for (const evt of events) {
        const startParsed = parseLocalTime(evt.start, timeZone);
        const endParsed = parseLocalTime(evt.end, timeZone);

        // Check if all-day event blocks the target date
        if (startParsed.isAllDay) {
          if (startParsed.date <= date && endParsed.date >= date) {
            return false;
          }
          continue;
        }

        // Timed event: check if it falls on target date
        if (startParsed.date <= date && endParsed.date >= date) {
          let evtStartMin = 0;
          let evtEndMin = 24 * 60;

          if (startParsed.date === date) {
            evtStartMin = startParsed.minutes;
          }
          if (endParsed.date === date) {
            evtEndMin = endParsed.minutes;
          }

          // Check overlap: slotStart < evtEnd && slotEnd > evtStart
          if (slotStartMin < evtEndMin && slotEndMin > evtStartMin) {
            return false; // Busy according to Google Calendar
          }
        }
      }

      // Check database appointments collision
      for (const apt of bookedAppointments) {
        const aptStartMin = toMinutes(apt.startTime);
        const aptEndMin = toMinutes(apt.endTime);
        if (slotStartMin < aptEndMin && slotEndMin > aptStartMin) {
          return false; // Busy according to booked appointment
        }
      }

      return true;
    });

    return {
      facultyId: faculty.id,
      facultyName: faculty.name,
      date,
      isConnected: true,
      workingHours: "9:00 AM – 4:00 PM",
      slots: availableSlots
    };
  }

  /**
   * Re-check Google Calendar in real time before booking (Requirement 4.5)
   */
  async checkFacultySlotAvailable(facultyId: string, date: string, startTime: string, endTime: string): Promise<{ available: boolean; reason?: string }> {
    const faculty = dbStore.facultyProfiles.get(facultyId);
    if (!faculty) {
      return { available: false, reason: 'Faculty not found' };
    }

    if (!this.isUserCalendarConnected(faculty.userId)) {
      return {
        available: false,
        reason: "Google Account Not Linked\n\nKindly contact the faculty personally to schedule an appointment."
      };
    }

    // Working hours constraint: 09:00 - 16:00
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (startMin < 9 * 60 || endMin > 16 * 60 || startMin >= endMin) {
      return {
        available: false,
        reason: "Requested appointment time is outside faculty working hours (9:00 AM – 4:00 PM)."
      };
    }

    // Re-check available slots from Google Calendar
    const availability = await this.getFacultyAvailableSlots(facultyId, date);
    if (!availability.isConnected) {
      return { available: false, reason: availability.message };
    }

    const isSlotFree = availability.slots.some(
      s => s.startTime === startTime && s.endTime === endTime
    );

    if (!isSlotFree) {
      return {
        available: false,
        reason: `The time slot ${startTime} - ${endTime} on ${date} is already occupied in the faculty's Google Calendar or booked.`
      };
    }

    return { available: true };
  }

  /**
   * Add an appointment event directly to the faculty's Google Calendar (Two-Way Sync: App -> Google Calendar)
   */
  async addAppointmentToCalendar(userId: string, appointment: Appointment): Promise<string | undefined> {
    const token = dbStore.googleTokens.get(userId);
    if (!token) {
      return undefined;
    }

    const isConfirmed = appointment.status === 'accepted' || appointment.status === 'confirmed';
    const summaryPrefix = isConfirmed ? 'Confirmed Academic Appointment' : 'Academic Appointment Request';
    const summary = `${summaryPrefix}: ${appointment.studentName} & ${appointment.facultyName}`;
    const description = `Appointment Purpose: ${appointment.purpose}\nNotes: ${appointment.notes || 'N/A'}\nStudent: ${appointment.studentName} (${appointment.studentEmail})\nFaculty: ${appointment.facultyName} (${appointment.facultyEmail})\nStatus: ${appointment.status.toUpperCase()}\nAppointment ID: ${appointment.id}`;

    const timeZone = await this.getCalendarTimeZone(userId);
    const startDateTime = this.formatRFC3339(appointment.date, appointment.startTime, timeZone);
    const endDateTime = this.formatRFC3339(appointment.date, appointment.endTime, timeZone);

    if (token.access_token.startsWith('mock_')) {
      const mockEventId = `gevent-apt-${appointment.id}`;
      const events = dbStore.calendarEvents.get(userId) || [];
      const filtered = events.filter(e => e.googleEventId !== mockEventId);
      filtered.push({
        id: `gevent-${mockEventId}`,
        userId,
        googleEventId: mockEventId,
        summary,
        description,
        start: startDateTime,
        end: endDateTime,
        location: 'Faculty Office / Campus',
        isAppointment: true,
        appointmentId: appointment.id,
        syncedAt: new Date().toISOString()
      });
      dbStore.calendarEvents.set(userId, filtered);
      return mockEventId;
    }

    try {
      const auth = this.getAuthorizedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary,
          description,
          start: {
            dateTime: startDateTime,
            timeZone: timeZone
          },
          end: {
            dateTime: endDateTime,
            timeZone: timeZone
          },
          attendees: [
            { email: appointment.studentEmail },
            { email: appointment.facultyEmail }
          ],
          reminders: {
            useDefault: true
          }
        }
      });

      const eventId = res.data.id || undefined;
      // Immediately refresh cached calendar events
      if (eventId) {
        await this.syncUserCalendar(userId).catch(() => {});
      }
      return eventId;
    } catch (err: any) {
      console.warn('Failed to insert Google Calendar event:', err.message);
      return undefined;
    }
  }

  /**
   * Update an existing appointment in the faculty's Google Calendar (e.g. when confirmed by faculty)
   */
  async updateAppointmentInCalendar(userId: string, appointment: Appointment): Promise<string | undefined> {
    const token = dbStore.googleTokens.get(userId);
    if (!token) {
      return undefined;
    }

    // If appointment hasn't been added to calendar yet, add it now
    if (!appointment.googleCalendarEventId) {
      return this.addAppointmentToCalendar(userId, appointment);
    }

    const isConfirmed = appointment.status === 'accepted' || appointment.status === 'confirmed';
    const summaryPrefix = isConfirmed ? 'Confirmed Academic Appointment' : 'Academic Appointment Request';
    const summary = `${summaryPrefix}: ${appointment.studentName} & ${appointment.facultyName}`;
    const description = `Appointment Purpose: ${appointment.purpose}\nNotes: ${appointment.notes || 'N/A'}\nStudent: ${appointment.studentName} (${appointment.studentEmail})\nFaculty: ${appointment.facultyName} (${appointment.facultyEmail})\nStatus: ${appointment.status.toUpperCase()}\nAppointment ID: ${appointment.id}`;

    const timeZone = await this.getCalendarTimeZone(userId);
    const startDateTime = this.formatRFC3339(appointment.date, appointment.startTime, timeZone);
    const endDateTime = this.formatRFC3339(appointment.date, appointment.endTime, timeZone);

    if (token.access_token.startsWith('mock_')) {
      const events = dbStore.calendarEvents.get(userId) || [];
      const idx = events.findIndex(e => e.googleEventId === appointment.googleCalendarEventId);
      if (idx >= 0) {
        events[idx].summary = summary;
        events[idx].description = description;
        events[idx].start = startDateTime;
        events[idx].end = endDateTime;
        events[idx].syncedAt = new Date().toISOString();
      } else {
        events.push({
          id: `gevent-${appointment.googleCalendarEventId}`,
          userId,
          googleEventId: appointment.googleCalendarEventId,
          summary,
          description,
          start: startDateTime,
          end: endDateTime,
          location: 'Faculty Office / Campus',
          isAppointment: true,
          appointmentId: appointment.id,
          syncedAt: new Date().toISOString()
        });
      }
      dbStore.calendarEvents.set(userId, events);
      return appointment.googleCalendarEventId;
    }

    try {
      const auth = this.getAuthorizedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.patch({
        calendarId: 'primary',
        eventId: appointment.googleCalendarEventId,
        requestBody: {
          summary,
          description,
          status: 'confirmed',
          start: {
            dateTime: startDateTime,
            timeZone: timeZone
          },
          end: {
            dateTime: endDateTime,
            timeZone: timeZone
          }
        }
      });

      await this.syncUserCalendar(userId).catch(() => {});
      return appointment.googleCalendarEventId;
    } catch (err: any) {
      console.warn('Failed to patch Google Calendar event, re-inserting:', err.message);
      return this.addAppointmentToCalendar(userId, appointment);
    }
  }

  /**
   * Delete or remove an appointment event from Google Calendar (when rejected or cancelled)
   */
  async deleteAppointmentFromCalendar(userId: string, googleEventId: string): Promise<boolean> {
    const token = dbStore.googleTokens.get(userId);
    if (!token || !googleEventId) {
      return false;
    }

    if (token.access_token.startsWith('mock_')) {
      const events = dbStore.calendarEvents.get(userId) || [];
      const filtered = events.filter(e => e.googleEventId !== googleEventId);
      dbStore.calendarEvents.set(userId, filtered);
      return true;
    }

    try {
      const auth = this.getAuthorizedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId
      });

      await this.syncUserCalendar(userId).catch(() => {});
      return true;
    } catch (err: any) {
      console.warn('Failed to delete Google Calendar event:', err.message);
      return false;
    }
  }

  /**
   * Periodic sync for all authorized users every 30 minutes
   */
  async periodicSyncAllUsers(): Promise<{ syncedCount: number; errors: number }> {
    let syncedCount = 0;
    let errors = 0;
    const userIds = Array.from(dbStore.googleTokens.keys());

    for (const userId of userIds) {
      try {
        await this.syncUserCalendar(userId);
        syncedCount++;
      } catch (err) {
        errors++;
      }
    }

    dbStore.lastPeriodicSync = new Date().toISOString();
    console.log(`[Periodic Calendar Sync] Synchronized ${syncedCount} accounts at ${dbStore.lastPeriodicSync}`);
    return { syncedCount, errors };
  }
}

export const googleService = new GoogleIntegrationService();
