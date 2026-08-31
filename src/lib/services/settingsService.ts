/**
 * settingsService.ts
 * Firestore read/write for system-wide settings.
 */
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SETTINGS_DOC = 'settings/system';

export interface SystemSettings {
  schoolCode?: string;
  schoolName?: string;
  logo?: string | null;
  academicYear?: string;
  term?: string;
  primaryColor?: string;
  secondaryColor?: string;
  lockdownMode?: boolean;
  allowRegistration?: boolean;
  defaultTheme?: string;
  welcomeMessage?: string;
  supportEmail?: string;
  supportPhone?: string;
  passingGrade?: number;
  gradingSystem?: string;
  maxUploadSize?: number;
  enableMessaging?: boolean;
  updatedAt?: string;
}

export async function getSettings(): Promise<SystemSettings> {
  const snap = await getDoc(doc(db, 'settings', 'system'));
  return snap.exists() ? (snap.data() as SystemSettings) : {};
}

export async function updateSettings(data: Partial<SystemSettings>): Promise<void> {
  await setDoc(doc(db, 'settings', 'system'), {
    ...data,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export function subscribeToSettings(callback: (settings: SystemSettings) => void) {
  return onSnapshot(doc(db, 'settings', 'system'), (snap) => {
    if (snap.exists()) callback(snap.data() as SystemSettings);
  });
}

/* ─── AUDIT LOGS ─────────────────────────────────────────── */
import { collection, addDoc, getDocs, query, orderBy, limit as fsLimit, deleteDoc } from 'firebase/firestore';

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export async function logAudit(data: {
  userId?: string;
  userName?: string;
  action: string;
  details?: string;
}): Promise<void> {
  const cleanLog = Object.fromEntries(
    Object.entries({
      ...data,
      createdAt: new Date().toISOString()
    }).filter(([_, v]) => v !== undefined)
  );
  await addDoc(collection(db, 'audit_logs'), cleanLog);
}

export async function getAuditLogs(count = 200): Promise<AuditLog[]> {
  const q = query(
    collection(db, 'audit_logs'),
    orderBy('createdAt', 'desc'),
    fsLimit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
}

export async function deleteAuditLog(id: string): Promise<void> {
  await deleteDoc(doc(db, 'audit_logs', id));
}

/* ─── LIVE CLASSES ───────────────────────────────────────── */
export interface LiveClass {
  id: string;
  title: string;
  description?: string;
  classId: string;
  className?: string;
  teacherId: string;
  teacherName?: string;
  scheduleDate: string;
  scheduleTime: string;
  durationMinutes: number;
  meetingUrl?: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt?: string;
}

export async function getLiveClasses(): Promise<LiveClass[]> {
  const snap = await getDocs(collection(db, 'live_classes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveClass));
}

export async function getLiveClassesForClass(classId: string): Promise<LiveClass[]> {
  const q = query(collection(db, 'live_classes'), orderBy('scheduleDate', 'asc'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LiveClass))
    .filter(lc => lc.classId === classId);
}

export async function createLiveClass(data: Omit<LiveClass, 'id'>): Promise<LiveClass> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, createdAt: new Date().toISOString() }).filter(([_, v]) => v !== undefined)
  );
  const ref = await addDoc(collection(db, 'live_classes'), clean);
  return { id: ref.id, ...data };
}

export async function updateLiveClass(id: string, data: Partial<LiveClass>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
  await updateDoc(doc(db, 'live_classes', id), clean);
}

export async function deleteLiveClass(id: string): Promise<void> {
  await deleteDoc(doc(db, 'live_classes', id));
}
