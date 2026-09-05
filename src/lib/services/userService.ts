/**
 * userService.ts
 * Firestore CRUD for Users, including role-aware queries.
 */
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, writeBatch,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  deleteUser as fbDeleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { db, auth, firebaseConfig } from '@/lib/firebase';

const USERS = 'users';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT';
  isActive: boolean;
  avatar?: string;
  gender?: string;
  mustChangePassword?: boolean;
  permissions?: Record<string, boolean>;
  classId?: string;
  className?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  subjects?: string;
  points?: number;
  loginCount?: number;
  createdAt?: string;
}

/* ─── Read ─────────────────────────────────────────────────── */
export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, USERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
}

export async function getUserById(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserProfile;
}

export async function getUsersByRole(role: string): Promise<UserProfile[]> {
  const q = query(collection(db, USERS), where('role', '==', role.toUpperCase()));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
}

export async function getStudentsByClass(classId: string): Promise<UserProfile[]> {
  const q = query(
    collection(db, USERS),
    where('role', '==', 'STUDENT'),
    where('classId', '==', classId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
}
/* ─── Check Email ────────────────────────────────────────────── */
export async function checkEmailExists(email: string): Promise<boolean> {
  if (!email || !email.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const q = query(collection(db, USERS), where('email', '==', normalized));
  const snap = await getDocs(q);
  if (!snap.empty) return true;
  // Fallback for case-sensitive legacy records
  const q2 = query(collection(db, USERS), where('email', '==', email.trim()));
  const snap2 = await getDocs(q2);
  return !snap2.empty;
}

/* ─── Create ────────────────────────────────────────────────── */
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT';
  classId?: string;
  className?: string;
  gender?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  mustChangePassword?: boolean;
}): Promise<UserProfile> {
  const cleanEmail = data.email.trim().toLowerCase();

  // Validate duplicate email in system before proceeding
  const exists = await checkEmailExists(cleanEmail);
  if (exists) {
    throw new Error(`The email "${cleanEmail}" is already in the system. Please choose a different email before continuing.`);
  }

  // Initialize an ephemeral secondary Firebase app so creating a new user
  // does NOT log out the currently logged-in administrator.
  const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    let uid: string;
    try {
      // Create in Firebase Auth via secondary app instance
      const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, data.password);
      uid = credential.user.uid;
    } catch (authErr: any) {
      // If auth already exists (e.g. previous creation attempt created the auth user but failed writing to Firestore)
      if (authErr.code === 'auth/email-already-in-use') {
        const firestoreExists = await checkEmailExists(cleanEmail);
        if (firestoreExists) {
          throw new Error(`The email "${cleanEmail}" is already in the system. Please choose a different email before continuing.`);
        }
        // Recover orphaned auth user's UID to complete the Firestore profile
        try {
          const recovered = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, data.password);
          uid = recovered.user.uid;
        } catch {
          throw new Error(`The email "${cleanEmail}" is already registered in Firebase Authentication. Please choose a different email.`);
        }
      } else {
        throw authErr;
      }
    }

    // Immediately sign out secondary auth session and clean up app
    try {
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
    } catch (_) {}

    const rawProfile = {
      email: cleanEmail,
      name: data.name.trim(),
      fullName: data.name.trim(),
      role: data.role,
      isActive: true,
      gender: data.gender,
      mustChangePassword: data.mustChangePassword ?? true,
      classId: data.classId,
      className: data.className,
      parentName: data.parentName,
      parentEmail: data.parentEmail,
      parentPhone: data.parentPhone,
      permissions: {},
      points: 0,
      loginCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Filter out all undefined keys so Firestore setDoc never throws
    // "unsupported field value: undefined"
    const cleanProfile = Object.fromEntries(
      Object.entries(rawProfile).filter(([_, v]) => v !== undefined)
    ) as Omit<UserProfile, 'id'>;

    // Save profile using the main db instance (admin is still authenticated)
    await setDoc(doc(db, USERS, uid), cleanProfile);
    return { id: uid, ...cleanProfile } as UserProfile;
  } catch (error: any) {
    try {
      await deleteApp(secondaryApp);
    } catch (_) {}

    if (error.code === 'auth/email-already-in-use') {
      throw new Error(`The email "${cleanEmail}" is already in the system. Please choose a different email before continuing.`);
    }
    throw error;
  }
}

/* ─── Update ────────────────────────────────────────────────── */
export async function updateUser(uid: string, data: Partial<UserProfile>): Promise<void> {
  const { id, ...rest } = data as any;
  const clean = Object.fromEntries(
    Object.entries(rest).filter(([_, v]) => v !== undefined)
  );
  await updateDoc(doc(db, USERS, uid), { ...clean, updatedAt: new Date().toISOString() });
}

export async function updateUserPermissions(uid: string, permissions: Record<string, boolean>): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { permissions, updatedAt: new Date().toISOString() });
}

export async function toggleUserActive(uid: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { isActive, updatedAt: new Date().toISOString() });
}

/* ─── Delete ────────────────────────────────────────────────── */
export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, USERS, uid));
}

/* ─── Stats ─────────────────────────────────────────────────── */
export async function getUserStats(): Promise<{ total: number; students: number; teachers: number; admins: number; active: number }> {
  const all = await getAllUsers();
  return {
    total: all.length,
    students: all.filter(u => u.role === 'STUDENT').length,
    teachers: all.filter(u => u.role === 'TEACHER').length,
    admins: all.filter(u => u.role === 'SUPER_ADMIN').length,
    active: all.filter(u => u.isActive !== false).length,
  };
}
