import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  Firestore 
} from 'firebase/firestore';
import { 
  FacultyProfile, 
  StudentProfile, 
  Appointment, 
  User, 
  SyncedCalendarEvent, 
  GoogleClientConfig 
} from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UserTokenData {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  google_email?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Remove any undefined values recursively so Firestore setDoc does not throw errors
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  }
  return clean;
}

/**
 * Persistent Map that writes mutations through to Firebase Firestore
 */
class PersistentMap<K extends string, V extends any> extends Map<K, V> {
  private collectionName: string;
  private onPersist?: (key: K, value: V) => Promise<void>;
  private onDelete?: (key: K) => Promise<void>;

  constructor(
    collectionName: string, 
    onPersist?: (key: K, value: V) => Promise<void>,
    onDelete?: (key: K) => Promise<void>
  ) {
    super();
    this.collectionName = collectionName;
    this.onPersist = onPersist;
    this.onDelete = onDelete;
  }

  set(key: K, value: V): this {
    super.set(key, value);
    if (this.onPersist) {
      this.onPersist(key, value).catch(err => {
        console.error(`[Firestore PersistentMap] Failed to persist ${this.collectionName}/${key}:`, err.message);
      });
    }
    return this;
  }

  delete(key: K): boolean {
    const res = super.delete(key);
    if (this.onDelete) {
      this.onDelete(key).catch(err => {
        console.error(`[Firestore PersistentMap] Failed to delete ${this.collectionName}/${key}:`, err.message);
      });
    }
    return res;
  }

  setWithoutPersist(key: K, value: V): this {
    return super.set(key, value);
  }
}

// Initialize Firestore client for backend
let firestoreDb: Firestore | null = null;
try {
  const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = initializeApp(config, 'backend-server-app');
    firestoreDb = getFirestore(app, config.firestoreDatabaseId);
    console.log('[Firestore] Backend Firebase App initialized with database:', config.firestoreDatabaseId);
  } else {
    console.warn('[Firestore] Warning: firebase-applet-config.json not found at:', configPath);
  }
} catch (err: any) {
  console.error('[Firestore] Initialization error:', err.message);
}

// Persistent Database Store backed by Firebase Firestore
class DatabaseStore {
  users: PersistentMap<string, User>;
  students: PersistentMap<string, StudentProfile>;
  facultyProfiles: PersistentMap<string, FacultyProfile>;
  appointments: PersistentMap<string, Appointment>;
  googleConfigs: PersistentMap<string, GoogleClientConfig>;
  googleTokens: PersistentMap<string, UserTokenData>;
  calendarEvents: PersistentMap<string, SyncedCalendarEvent[]>;

  private _customGeminiApiKey: string = '';
  private _llmModel: string = 'gemma-4-26b-a4b-it';
  private _lastPeriodicSync: string = new Date().toISOString();
  private _initialized: boolean = false;

  constructor() {
    // 1. Users persistence
    this.users = new PersistentMap('users', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'users', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'users', key));
    });

    // 2. Students persistence
    this.students = new PersistentMap('students', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'students', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'students', key));
    });

    // 3. Faculty Profiles persistence
    this.facultyProfiles = new PersistentMap('faculty_profiles', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'faculty_profiles', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'faculty_profiles', key));
    });

    // 4. Appointments persistence
    this.appointments = new PersistentMap('appointments', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'appointments', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'appointments', key));
    });

    // 5. Google Configs persistence
    this.googleConfigs = new PersistentMap('google_configs', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'google_configs', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'google_configs', key));
    });

    // 6. Google Tokens persistence
    this.googleTokens = new PersistentMap('google_tokens', async (key, val) => {
      if (!firestoreDb) return;
      await setDoc(doc(firestoreDb, 'google_tokens', key), sanitizeForFirestore(val));
    }, async (key) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'google_tokens', key));
    });

    // 7. Calendar Events persistence (stored per-user array & subcollection)
    this.calendarEvents = new PersistentMap('calendar_events', async (userId, events) => {
      if (!firestoreDb) return;
      // Store user collection summary
      await setDoc(doc(firestoreDb, 'calendar_events', userId), {
        userId,
        events: sanitizeForFirestore(events),
        updatedAt: new Date().toISOString()
      });

      // Also persist to users/{userId}/calendar_events subcollection
      for (const evt of events) {
        const eventId = evt.googleEventId || evt.id;
        if (eventId) {
          await setDoc(
            doc(firestoreDb, 'users', userId, 'calendar_events', eventId),
            sanitizeForFirestore(evt)
          ).catch(() => {});
        }
      }
    }, async (userId) => {
      if (!firestoreDb) return;
      await deleteDoc(doc(firestoreDb, 'calendar_events', userId));
    });

    // Seed default admin in local memory initially
    this.seedInitialDatabase();
  }

  get customGeminiApiKey(): string {
    return this._customGeminiApiKey;
  }
  set customGeminiApiKey(val: string) {
    this._customGeminiApiKey = val;
    this.persistLlmConfig();
  }

  get llmModel(): string {
    return this._llmModel;
  }
  set llmModel(val: string) {
    this._llmModel = val;
    this.persistLlmConfig();
  }

  get lastPeriodicSync(): string {
    return this._lastPeriodicSync;
  }
  set lastPeriodicSync(val: string) {
    this._lastPeriodicSync = val;
    this.persistLlmConfig();
  }

  async persistLlmConfig() {
    if (!firestoreDb) return;
    try {
      const ref = doc(firestoreDb, 'system_settings', 'llm_config');
      await setDoc(ref, {
        id: 'llm_config',
        customGeminiApiKey: this._customGeminiApiKey,
        llmModel: this._llmModel,
        lastPeriodicSync: this._lastPeriodicSync,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err: any) {
      console.warn('[Firestore] Failed to persist system settings to Firestore:', err.message);
    }
  }

  /**
   * Asynchronously hydrate all records from Firebase Firestore
   */
  async init(): Promise<void> {
    if (this._initialized) return;
    if (!firestoreDb) {
      console.warn('[Firestore] Firestore is not configured. Running in in-memory mode.');
      this._initialized = true;
      return;
    }

    try {
      console.log('[Firestore] Hydrating database from Firestore...');

      // 1. Load System Settings / LLM Config
      try {
        const llmSnap = await getDoc(doc(firestoreDb, 'system_settings', 'llm_config'));
        if (llmSnap.exists()) {
          const data = llmSnap.data();
          if (data.customGeminiApiKey !== undefined) this._customGeminiApiKey = data.customGeminiApiKey;
          if (data.llmModel) this._llmModel = data.llmModel;
          if (data.lastPeriodicSync) this._lastPeriodicSync = data.lastPeriodicSync;
          console.log('[Firestore] Loaded system settings. Active LLM model:', this._llmModel);
        } else {
          await this.persistLlmConfig();
        }
      } catch (e: any) {
        console.warn('[Firestore] Failed to load system settings:', e.message);
      }

      // 2. Load Users
      try {
        const usersSnap = await getDocs(collection(firestoreDb, 'users'));
        usersSnap.forEach(d => {
          this.users.setWithoutPersist(d.id, d.data() as User);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load users collection:', e.message);
      }

      // Ensure default administrator exists in Firestore
      const adminDoc = await getDoc(doc(firestoreDb, 'users', 'admin'));
      if (!adminDoc.exists()) {
        console.log('[Firestore] Persisting default administrator into Firestore users collection...');
        const adminUser: User = this.users.get('admin') || {
          id: 'admin',
          username: 'admin',
          passwordHash: hashPassword('admin'),
          email: 'admin@institution.edu',
          displayName: 'System Administrator',
          role: 'ADMIN',
          department: 'Administration',
          disabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(firestoreDb, 'users', 'admin'), sanitizeForFirestore(adminUser));
        this.users.setWithoutPersist(adminUser.id, adminUser);
      }

      // 3. Load Students
      try {
        const studentsSnap = await getDocs(collection(firestoreDb, 'students'));
        studentsSnap.forEach(d => {
          this.students.setWithoutPersist(d.id, d.data() as StudentProfile);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load students collection:', e.message);
      }

      // 4. Load Faculty Profiles
      try {
        const facultySnap = await getDocs(collection(firestoreDb, 'faculty_profiles'));
        facultySnap.forEach(d => {
          this.facultyProfiles.setWithoutPersist(d.id, d.data() as FacultyProfile);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load faculty profiles collection:', e.message);
      }

      // 5. Load Appointments
      try {
        const appointmentsSnap = await getDocs(collection(firestoreDb, 'appointments'));
        appointmentsSnap.forEach(d => {
          this.appointments.setWithoutPersist(d.id, d.data() as Appointment);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load appointments collection:', e.message);
      }

      // 6. Load Google Configs
      try {
        const configsSnap = await getDocs(collection(firestoreDb, 'google_configs'));
        configsSnap.forEach(d => {
          this.googleConfigs.setWithoutPersist(d.id, d.data() as GoogleClientConfig);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load google configs collection:', e.message);
      }

      // 7. Load Google Tokens
      try {
        const tokensSnap = await getDocs(collection(firestoreDb, 'google_tokens'));
        tokensSnap.forEach(d => {
          this.googleTokens.setWithoutPersist(d.id, d.data() as UserTokenData);
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load google tokens collection:', e.message);
      }

      // 8. Load Synced Calendar Events
      try {
        const calSnap = await getDocs(collection(firestoreDb, 'calendar_events'));
        calSnap.forEach(d => {
          const data = d.data();
          if (data && Array.isArray(data.events)) {
            this.calendarEvents.setWithoutPersist(d.id, data.events as SyncedCalendarEvent[]);
          }
        });
      } catch (e: any) {
        console.warn('[Firestore] Failed to load calendar events collection:', e.message);
      }

      this._initialized = true;
      console.log(`[Firestore] Database hydration complete: ${this.users.size} users, ${this.students.size} students, ${this.facultyProfiles.size} faculty, ${this.appointments.size} appointments.`);
    } catch (err: any) {
      console.error('[Firestore] Fatal error during Firestore hydration:', err.message);
      this._initialized = true;
    }
  }

  seedInitialDatabase() {
    const adminUser: User = {
      id: 'admin',
      username: 'admin',
      passwordHash: hashPassword('admin'),
      email: 'admin@institution.edu',
      displayName: 'System Administrator',
      role: 'ADMIN',
      department: 'Administration',
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.users.setWithoutPersist(adminUser.id, adminUser);
  }

  // Find user by username/user ID
  findUserByUsername(username: string): User | undefined {
    const cleanUsername = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === cleanUsername) {
        return user;
      }
    }
    return undefined;
  }

  // Create Student
  createStudent(data: {
    username: string;
    password: string;
    name: string;
    email: string;
    department: string;
    studentId: string;
    phone?: string;
  }): { user: User; student: StudentProfile } {
    const existing = this.findUserByUsername(data.username);
    if (existing) {
      throw new Error(`User ID "${data.username}" is already in use.`);
    }

    const userId = `student-${Date.now().toString().slice(-6)}`;
    const user: User = {
      id: userId,
      username: data.username.trim(),
      passwordHash: hashPassword(data.password),
      displayName: data.name.trim(),
      email: data.email.trim(),
      role: 'STUDENT',
      department: data.department.trim(),
      studentId: data.studentId.trim(),
      phone: data.phone?.trim() || '',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const student: StudentProfile = {
      id: `sp-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      username: user.username,
      name: user.displayName,
      email: user.email,
      department: user.department || '',
      studentId: user.studentId || '',
      phone: user.phone || '',
      disabled: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Storing in PersistentMaps automatically persists to Firestore
    this.users.set(user.id, user);
    this.students.set(student.id, student);
    return { user, student };
  }

  // Create Faculty
  createFaculty(data: {
    username: string;
    password: string;
    name: string;
    email: string;
    department: string;
    title: string;
    officeLocation?: string;
    bio?: string;
  }): { user: User; faculty: FacultyProfile } {
    const existing = this.findUserByUsername(data.username);
    if (existing) {
      throw new Error(`User ID "${data.username}" is already in use.`);
    }

    const userId = `faculty-${Date.now().toString().slice(-6)}`;
    const user: User = {
      id: userId,
      username: data.username.trim(),
      passwordHash: hashPassword(data.password),
      displayName: data.name.trim(),
      email: data.email.trim(),
      role: 'FACULTY',
      department: data.department.trim(),
      title: data.title.trim(),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const facultyId = `fac-${Date.now().toString().slice(-6)}`;
    const faculty: FacultyProfile = {
      id: facultyId,
      userId: user.id,
      username: user.username,
      name: user.displayName,
      email: user.email,
      department: user.department || '',
      title: data.title.trim(),
      officeLocation: data.officeLocation?.trim() || '',
      bio: data.bio?.trim() || '',
      disabled: false,
      isGoogleConnected: false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Storing in PersistentMaps automatically persists to Firestore
    this.users.set(user.id, user);
    this.facultyProfiles.set(faculty.id, faculty);
    return { user, faculty };
  }
}

export const dbStore = new DatabaseStore();
