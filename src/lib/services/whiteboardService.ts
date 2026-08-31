/**
 * whiteboardService.ts
 * Firestore CRUD for Saved Whiteboard Canvases
 */
import {
  collection, doc, getDocs, getDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const WHITEBOARDS = 'whiteboards';

export interface WhiteboardDoc {
  id: string;
  title: string;
  elements: any[]; // Vector path and shape objects
  previewDataUrl?: string;
  authorId: string;
  authorName: string;
  courseId?: string;
  isShared: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getWhiteboards(authorId?: string): Promise<WhiteboardDoc[]> {
  try {
    const coll = collection(db, WHITEBOARDS);
    const snap = await getDocs(coll);
    const boards = snap.docs.map(d => ({ id: d.id, ...d.data() } as WhiteboardDoc));
    if (authorId) {
      return boards.filter(b => b.authorId === authorId || b.isShared);
    }
    return boards;
  } catch (err) {
    console.error('getWhiteboards error:', err);
    return [];
  }
}

export async function getWhiteboardById(id: string): Promise<WhiteboardDoc | null> {
  const snap = await getDoc(doc(db, WHITEBOARDS, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WhiteboardDoc;
}

export async function saveWhiteboard(data: {
  id?: string;
  title: string;
  elements: any[];
  previewDataUrl?: string;
  authorId: string;
  authorName: string;
  courseId?: string;
  isShared?: boolean;
}): Promise<string> {
  if (data.id) {
    await updateDoc(doc(db, WHITEBOARDS, data.id), {
      title: data.title,
      elements: data.elements,
      previewDataUrl: data.previewDataUrl || null,
      isShared: data.isShared ?? false,
      updatedAt: new Date().toISOString(),
    });
    return data.id;
  } else {
    const ref = await addDoc(collection(db, WHITEBOARDS), {
      title: data.title,
      elements: data.elements,
      previewDataUrl: data.previewDataUrl || null,
      authorId: data.authorId,
      authorName: data.authorName,
      courseId: data.courseId || null,
      isShared: data.isShared ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  }
}

export async function deleteWhiteboard(id: string): Promise<void> {
  await deleteDoc(doc(db, WHITEBOARDS, id));
}
