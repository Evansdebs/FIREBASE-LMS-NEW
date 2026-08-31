/**
 * userService.ts
 * Firestore CRUD for Users, including role-aware queries.
 */
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, writeBatch,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword,
  deleteUser as fbDeleteUser,
  getAuth,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { db, auth } from '@/lib/firebase';

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

/* ─── Create ────────────────────────────────────────────────── */
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: 'TEACHER' | 'STUDENT';
  classId?: string;
  className?: string;
  gender?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  mustChangePassword?: boolean;
}): Promise<UserProfile> {
  // Create in Firebase Auth first
  const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  const uid = credential.user.uid;

  const profile: Omit<UserProfile, 'id'> = {
    email: data.email,
    name: data.name,
    fullName: data.name,
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

  await setDoc(doc(db, USERS, uid), profile);
  return { id: uid, ...profile };
}

/* ─── Update ────────────────────────────────────────────────── */
export async function updateUser(uid: string, data: Partial<UserProfile>): Promise<void> {
  const { id, ...rest } = data as any;
  await updateDoc(doc(db, USERS, uid), { ...rest, updatedAt: new Date().toISOString() });
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
