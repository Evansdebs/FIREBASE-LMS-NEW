/**
 * materialService.ts
 * Firestore CRUD for resource library materials, notes, forum, shop.
 */
import {
  collection, doc, getDocs, getDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── MATERIALS ─────────────────────────────────────────── */
export interface MaterialDoc {
  id: string;
  topicId?: string;
  type: 'PDF' | 'VIDEO' | 'LINK' | 'IMAGE' | 'DOCUMENT';
  fileName: string;
  filePath?: string;
  description?: string;
  textContent?: string;
  externalUrl?: string;
  isGlobal: boolean;
  uploadedBy: string;
  uploaderName?: string;
  createdAt?: string;
}

export async function getMaterials(topicId?: string): Promise<MaterialDoc[]> {
  const col = collection(db, 'materials');
  const q = topicId
    ? query(col, where('topicId', '==', topicId))
    : query(col, where('isGlobal', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaterialDoc));
}

export async function createMaterial(data: Omit<MaterialDoc, 'id'>): Promise<MaterialDoc> {
  const ref = await addDoc(collection(db, 'materials'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateMaterial(id: string, data: Partial<MaterialDoc>): Promise<void> {
  await updateDoc(doc(db, 'materials', id), data);
}

export async function deleteMaterial(id: string): Promise<void> {
  await deleteDoc(doc(db, 'materials', id));
}

/* ─── NOTES ─────────────────────────────────────────────── */
export interface NoteDoc {
  id: string;
  userId: string;
  courseId?: string;
  title: string;
  content: string;
  category: string;
  notebook: string;
  style: string;
  color: string;
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getNotes(userId: string): Promise<NoteDoc[]> {
  const q = query(collection(db, 'notes'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NoteDoc));
}

export async function createNote(data: Omit<NoteDoc, 'id'>): Promise<NoteDoc> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'notes'), { ...data, createdAt: now, updatedAt: now });
  return { id: ref.id, ...data };
}

export async function updateNote(id: string, data: Partial<NoteDoc>): Promise<void> {
  await updateDoc(doc(db, 'notes', id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteNote(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notes', id));
}

/* ─── FORUM ─────────────────────────────────────────────── */
export interface ForumCategory {
  id: string;
  name: string;
  description?: string;
  subjectId?: string;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  categoryName?: string;
  authorId: string;
  authorName?: string;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  postCount?: number;
  createdAt?: string;
}

export interface ForumPost {
  id: string;
  threadId: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  createdAt?: string;
}

export async function getForumCategories(): Promise<ForumCategory[]> {
  const snap = await getDocs(collection(db, 'forum_categories'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumCategory));
}

export async function createForumCategory(data: Omit<ForumCategory, 'id'>): Promise<ForumCategory> {
  const ref = await addDoc(collection(db, 'forum_categories'), data);
  return { id: ref.id, ...data };
}

export async function getForumThreads(categoryId?: string): Promise<ForumThread[]> {
  const col = collection(db, 'forum_threads');
  const q = categoryId ? query(col, where('categoryId', '==', categoryId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumThread));
}

export async function createForumThread(data: Omit<ForumThread, 'id'>): Promise<ForumThread> {
  const ref = await addDoc(collection(db, 'forum_threads'), { ...data, postCount: 0, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function getForumPosts(threadId: string): Promise<ForumPost[]> {
  const q = query(collection(db, 'forum_posts'), where('threadId', '==', threadId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost));
}

export async function createForumPost(data: Omit<ForumPost, 'id'>): Promise<ForumPost> {
  const ref = await addDoc(collection(db, 'forum_posts'), { ...data, createdAt: new Date().toISOString() });
  // increment post count
  const threadRef = doc(db, 'forum_threads', data.threadId);
  const threadSnap = await getDoc(threadRef);
  if (threadSnap.exists()) {
    await updateDoc(threadRef, { postCount: (threadSnap.data().postCount || 0) + 1 });
  }
  return { id: ref.id, ...data };
}

/* ─── SHOP ─────────────────────────────────────────────── */
export interface ShopItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  contactPhone?: string;
  createdBy: string;
  createdByName?: string;
  createdAt?: string;
}

export async function getShopItems(status?: string): Promise<ShopItem[]> {
  const col = collection(db, 'shop_items');
  const q = status ? query(col, where('status', '==', status)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShopItem));
}

export async function createShopItem(data: Omit<ShopItem, 'id'>): Promise<ShopItem> {
  const ref = await addDoc(collection(db, 'shop_items'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateShopItem(id: string, data: Partial<ShopItem>): Promise<void> {
  await updateDoc(doc(db, 'shop_items', id), data);
}

export async function deleteShopItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'shop_items', id));
}

/* ─── SIMULATIONS ─────────────────────────────────────────── */
export interface Simulation {
  id: string;
  title: string;
  description?: string;
  category: string;
  iframeUrl: string;
  thumbnail?: string;
  isGlobal: boolean;
  uploadedBy: string;
  createdAt?: string;
}

export async function getSimulations(): Promise<Simulation[]> {
  const snap = await getDocs(collection(db, 'simulations'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Simulation));
}

export async function createSimulation(data: Omit<Simulation, 'id'>): Promise<Simulation> {
  const ref = await addDoc(collection(db, 'simulations'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateSimulation(id: string, data: Partial<Simulation>): Promise<void> {
  await updateDoc(doc(db, 'simulations', id), data);
}

export async function deleteSimulation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'simulations', id));
}
