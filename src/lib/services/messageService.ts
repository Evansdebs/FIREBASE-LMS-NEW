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
  const uid1 = String(userId1);
  const uid2 = String(userId2);
  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', uid1)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MessageDoc))
        .filter(m => String(m.senderId) === uid2 || String(m.receiverId) === uid2)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      callback(msgs);
    },
    (error) => {
      console.error('Messages subscription error:', error);
      callback([]);
    }
  );
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
  const sId = String(data.senderId);
  const rId = String(data.receiverId);
  const msg = cleanData({
    ...data,
    senderId: sId,
    receiverId: rId,
    type: data.type || 'TEXT',
    isRead: false,
    participants: [sId, rId],
    createdAt: new Date().toISOString()
  });
  const ref = await addDoc(collection(db, 'messages'), msg);
  return { id: ref.id, ...msg } as MessageDoc;
}

export async function markMessagesAsRead(senderId: string, receiverId: string): Promise<void> {
  const q = query(
    collection(db, 'messages'),
    where('senderId', '==', String(senderId)),
    where('receiverId', '==', String(receiverId)),
    where('isRead', '==', false)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { isRead: true })));
}

export async function getConversations(userId: string): Promise<string[]> {
  const uid = String(userId);
  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', uid),
    limit(100)
  );
  const snap = await getDocs(q);
  const users = new Set<string>();
  snap.docs.forEach(doc => {
    const msg = doc.data() as MessageDoc;
    if (String(msg.senderId) !== uid) users.add(String(msg.senderId));
    if (String(msg.receiverId) !== uid) users.add(String(msg.receiverId));
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
  user?: { name?: string };
}

export function subscribeToNotifications(
  userId: string,
  role: string,
  callback: (notifications: NotificationDoc[]) => void
) {
  // Listen to notifications collection without requiring compound indexes
  const col = collection(db, 'notifications');
  const normalizedRole = (role || '').toLowerCase();
  const uid = String(userId);

  return onSnapshot(
    col,
    (snap) => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as NotificationDoc))
        .filter(n => {
          if (n.isGlobal) return true;
          if (n.userId && String(n.userId) === uid) return true;
          if (n.targetRole) {
            const target = n.targetRole.toLowerCase();
            if (target === 'all' || target === normalizedRole) return true;
            if (target.includes('teacher') && normalizedRole.includes('teacher')) return true;
            if (target.includes('student') && normalizedRole.includes('student')) return true;
            if (target.includes('admin') && normalizedRole.includes('admin')) return true;
          }
          return false;
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(all);
    },
    (error) => {
      console.error('Notifications subscription error:', error);
      callback([]);
    }
  );
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
    isGlobal: data.isGlobal ?? true,
    createdAt: new Date().toISOString()
  });
  const ref = await addDoc(collection(db, 'notifications'), notif);
  return { id: ref.id, ...notif } as NotificationDoc;
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}
