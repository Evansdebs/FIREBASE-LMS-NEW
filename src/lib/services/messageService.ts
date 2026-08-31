/**
 * messageService.ts
 * Firestore real-time direct messages and notifications.
 */
import {
  collection, doc, getDocs,
  addDoc, updateDoc, query, where, orderBy, onSnapshot,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── MESSAGES ───────────────────────────────────────────── */
export interface MessageDoc {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName?: string;
  message: string;
  type: 'TEXT' | 'FILE';
  isRead: boolean;
  createdAt: string;
}

export function subscribeToConversation(
  userId1: string,
  userId2: string,
  callback: (messages: MessageDoc[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', userId1),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MessageDoc))
      .filter(m => m.senderId === userId2 || m.receiverId === userId2);
    callback(msgs);
  });
}

function cleanData<T extends Record<string, any>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  ) as T;
}

export async function sendMessage(data: {
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  message: string;
  type?: 'TEXT' | 'FILE';
}): Promise<MessageDoc> {
  const msg = cleanData({
    ...data,
    type: data.type || 'TEXT',
    isRead: false,
    participants: [data.senderId, data.receiverId],
    createdAt: new Date().toISOString()
  });
  const ref = await addDoc(collection(db, 'messages'), msg);
  return { id: ref.id, ...msg } as MessageDoc;
}

export async function markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
  const q = query(
    collection(db, 'messages'),
    where('senderId', '==', senderId),
    where('receiverId', '==', receiverId),
    where('isRead', '==', false)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { isRead: true })));
}

export async function getConversations(userId: string): Promise<string[]> {
  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  const users = new Set<string>();
  snap.docs.forEach(doc => {
    const msg = doc.data() as MessageDoc;
    if (msg.senderId !== userId) users.add(msg.senderId);
    if (msg.receiverId !== userId) users.add(msg.receiverId);
  });
  return Array.from(users);
}

/* ─── NOTIFICATIONS ───────────────────────────────────────── */
export interface NotificationDoc {
  id: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  isGlobal: boolean;
  targetRole?: string;
  createdAt: string;
}

export function subscribeToNotifications(
  userId: string,
  role: string,
  callback: (notifications: NotificationDoc[]) => void
) {
  // Listen to user-specific and global notifications
  const q = query(
    collection(db, 'notifications'),
    where('isGlobal', '==', true),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationDoc));
    callback(all);
  });
}

export async function createNotification(data: {
  userId?: string;
  type: string;
  title: string;
  message: string;
  isGlobal?: boolean;
  targetRole?: string;
}): Promise<NotificationDoc> {
  const notif = cleanData({
    ...data,
    isRead: false,
    isGlobal: data.isGlobal ?? false,
    createdAt: new Date().toISOString()
  });
  const ref = await addDoc(collection(db, 'notifications'), notif);
  return { id: ref.id, ...notif } as NotificationDoc;
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}
