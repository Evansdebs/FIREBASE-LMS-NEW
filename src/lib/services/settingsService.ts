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
  textColorLight?: string;
  textColorDark?: string;
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

/* ─── SYSTEM BACKUPS (CLOUD & LOCAL) ─────────────────────── */
import { writeBatch } from 'firebase/firestore';

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
  totalRecords: number;
  collections: Record<string, number>;
  snapshotData?: any;
}

const BACKUP_COLLECTIONS = [
  'users',
  'classes',
  'courses',
  'topics',
  'assignments',
  'submissions',
  'quizzes',
  'quiz_attempts',
  'notes',
  'materials',
  'forum_threads',
  'forum_categories',
  'shop_items',
  'notifications',
  'live_classes',
  'settings'
];

export async function generateBackupData(): Promise<{ meta: any; data: Record<string, any[]> }> {
  const data: Record<string, any[]> = {};
  const collectionCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const colName of BACKUP_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data[colName] = docs;
      collectionCounts[colName] = docs.length;
      totalRecords += docs.length;
    } catch (e) {
      console.warn(`Could not backup collection ${colName}:`, e);
      data[colName] = [];
      collectionCounts[colName] = 0;
    }
  }

  const meta = {
    version: '2.0-firestore',
    createdAt: new Date().toISOString(),
    totalRecords,
    collections: collectionCounts
  };

  return { meta, data };
}

export async function restoreFromBackupData(backupPayload: any): Promise<{ restored: number; collections: string[] }> {
  const data = backupPayload.data || backupPayload;
  let restored = 0;
  const restoredCols: string[] = [];

  for (const colName of BACKUP_COLLECTIONS) {
    const records = data[colName];
    if (Array.isArray(records) && records.length > 0) {
      // Chunk batches by 450 (Firestore limit is 500)
      const chunkSize = 400;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const { id, ...itemData } = item;
          if (id) {
            const clean = Object.fromEntries(
              Object.entries(itemData).filter(([_, v]) => v !== undefined)
            );
            batch.set(doc(db, colName, String(id)), clean, { merge: true });
            restored++;
          }
        }
        await batch.commit();
      }
      restoredCols.push(colName);
    }
  }

  return { restored, collections: restoredCols };
}

export async function createCloudBackup(): Promise<BackupMetadata> {
  const { meta, data } = await generateBackupData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `onereal_lms_backup_${timestamp}.json`;
  const jsonStr = JSON.stringify({ meta, data });
  const size = new Blob([jsonStr]).size;

  const backupDoc = {
    filename,
    createdAt: meta.createdAt,
    size,
    totalRecords: meta.totalRecords,
    collections: meta.collections,
    snapshotData: { meta, data }
  };

  const ref = await addDoc(collection(db, 'system_backups'), backupDoc);
  return { id: ref.id, ...backupDoc };
}

export async function getCloudBackups(): Promise<BackupMetadata[]> {
  try {
    const snap = await getDocs(collection(db, 'system_backups'));
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          filename: data.filename || `backup_${d.id}.json`,
          createdAt: data.createdAt || new Date().toISOString(),
          size: data.size || 0,
          totalRecords: data.totalRecords || 0,
          collections: data.collections || {},
          snapshotData: data.snapshotData
        } as BackupMetadata;
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.error('Failed to get cloud backups:', err);
    return [];
  }
}

export async function deleteCloudBackup(id: string): Promise<void> {
  await deleteDoc(doc(db, 'system_backups', id));
}

export async function restoreCloudBackup(backup: BackupMetadata): Promise<{ restored: number }> {
  let payload = backup.snapshotData;
  if (!payload) {
    const snap = await getDoc(doc(db, 'system_backups', backup.id));
    if (snap.exists()) {
      payload = snap.data().snapshotData;
    }
  }
  if (!payload) {
    throw new Error('Backup snapshot data not found');
  }
  return await restoreFromBackupData(payload);
}

