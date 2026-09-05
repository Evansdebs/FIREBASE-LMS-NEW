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
  title?: string;
  type: 'PDF' | 'VIDEO' | 'LINK' | 'IMAGE' | 'DOCUMENT' | 'WORD' | 'EXCEL' | 'AUDIO' | 'TEXT';
  fileName: string;
  filePath?: string;
  fileUrl?: string;
  fileSize?: number;
  description?: string;
  textContent?: string;
  externalUrl?: string;
  isGlobal: boolean;
  uploadedBy?: string;
  uploaderName?: string;
  createdAt?: string;
}

export async function getMaterials(topicId?: string): Promise<MaterialDoc[]> {
  const col = collection(db, 'materials');
  const q = topicId ? query(col, where('topicId', '==', topicId)) : col;
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

function cleanData<T extends Record<string, any>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  ) as T;
}

/* ─── NOTES ─────────────────────────────────────────────── */
export interface NoteDoc {
  id: string;
  userId: string;
  authorName?: string;
  courseId?: string;
  title: string;
  content: string;
  category?: string;
  notebook?: string;
  style?: string;
  color?: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'video';
  duration?: number;
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getNotes(userId?: string): Promise<NoteDoc[]> {
  const col = collection(db, 'notes');
  const snap = await getDocs(col);
  const notes = snap.docs.map(d => ({ id: d.id, ...d.data() } as NoteDoc));
  if (userId) {
    const uid = String(userId);
    return notes.filter(n => String(n.userId) === uid || n.isShared);
  }
  return notes;
}

export async function createNote(data: Omit<NoteDoc, 'id'>): Promise<NoteDoc> {
  const now = new Date().toISOString();
  const cleaned = cleanData({
    ...data,
    category: data.category || 'General',
    notebook: data.notebook || 'My Notebook',
    style: data.style || 'ruled',
    color: data.color || '#fffdf5',
    createdAt: now,
    updatedAt: now
  });
  const ref = await addDoc(collection(db, 'notes'), cleaned);
  return { id: ref.id, ...cleaned } as NoteDoc;
}

export async function updateNote(id: string, data: Partial<NoteDoc>): Promise<void> {
  const cleaned = cleanData({ ...data, updatedAt: new Date().toISOString() });
  await updateDoc(doc(db, 'notes', id), cleaned);
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
  try {
    const col = collection(db, 'forum_threads');
    const q = categoryId ? query(col, where('categoryId', '==', categoryId)) : col;
    const snap = await getDocs(q);
    const threads = snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumThread));
    return threads.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  } catch (error) {
    console.error('Error fetching forum threads:', error);
    return [];
  }
}

export async function createForumThread(data: Omit<ForumThread, 'id'>): Promise<ForumThread> {
  const threadData = { ...data, postCount: 0, createdAt: new Date().toISOString() };
  const ref = await addDoc(collection(db, 'forum_threads'), threadData);
  try {
    if (data.categoryId) {
      const catRef = doc(db, 'forum_categories', data.categoryId);
      const catSnap = await getDoc(catRef);
      if (catSnap.exists()) {
        await updateDoc(catRef, { threadCount: (catSnap.data().threadCount || 0) + 1 });
      }
    }
  } catch (_) {}
  return { id: ref.id, ...threadData };
}

export async function getForumPosts(threadId: string): Promise<ForumPost[]> {
  try {
    // Querying without compound orderBy avoids Firestore composite index requirements
    const q = query(collection(db, 'forum_posts'), where('threadId', '==', threadId));
    const snap = await getDocs(q);
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost));
    return posts.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (error) {
    console.error('Error fetching forum posts:', error);
    return [];
  }
}

export async function createForumPost(data: Omit<ForumPost, 'id'>): Promise<ForumPost> {
  const postData = { ...data, createdAt: new Date().toISOString() };
  const ref = await addDoc(collection(db, 'forum_posts'), postData);
  // increment post count on thread
  try {
    const threadRef = doc(db, 'forum_threads', data.threadId);
    const threadSnap = await getDoc(threadRef);
    if (threadSnap.exists()) {
      await updateDoc(threadRef, { postCount: (threadSnap.data().postCount || 0) + 1 });
    }
  } catch (_) {}
  return { id: ref.id, ...postData };
}
/* ─── SHOP ─────────────────────────────────────────────── */
export interface ShopItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  images?: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  contactPhone?: string;
  createdBy: string;
  createdByName?: string;
  creatorEmail?: string;
  creatorUsername?: string;
  creator?: {
    name?: string;
    email?: string;
    username?: string;
    phone?: string;
  };
  interestedUsers?: string[];
  interestCount?: number;
  hasInterest?: boolean;
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

export async function toggleShopItemInterest(itemId: string, userId: string): Promise<boolean> {
  const itemRef = doc(db, 'shop_items', itemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  const interested: string[] = Array.isArray(data.interestedUsers) ? data.interestedUsers : [];
  const uid = String(userId);
  const hasInterest = interested.includes(uid);
  const updated = hasInterest ? interested.filter(id => id !== uid) : [...interested, uid];
  await updateDoc(itemRef, {
    interestedUsers: updated,
    interestCount: updated.length
  });
  return !hasInterest;
}

/* ─── SIMULATIONS ─────────────────────────────────────────── */
export interface Simulation {
  id: string;
  title: string;
  description?: string;
  category: string;
  level?: string;
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
