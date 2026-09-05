/**
 * assignmentService.ts
 * Firestore CRUD for Assignments and Submissions.
 */
import {
  collection, doc, getDocs, getDoc, addDoc,
  updateDoc, deleteDoc, query, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── ASSIGNMENTS ─────────────────────────────────────────── */
export interface AssignmentDoc {
  id: string;
  courseId: string;
  courseTitle?: string;
  title: string;
  description?: string;
  deadline: string;
  maxScore: number;
  filePath?: string;
  isPublished: boolean;
  createdBy: string;
  createdByName?: string;
  classIds?: string[];
  rubricCriteria?: { name: string; maxPoints: number; orderIndex: number }[];
  createdAt?: string;
}

export async function getAssignments(courseId?: string): Promise<AssignmentDoc[]> {
  const col = collection(db, 'assignments');
  const q = courseId ? query(col, where('courseId', '==', courseId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentDoc));
}

export async function getAssignmentsForClass(classId: string): Promise<AssignmentDoc[]> {
  const q = query(
    collection(db, 'assignments'),
    where('classIds', 'array-contains', classId),
    where('isPublished', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignmentDoc));
}

export async function getAssignmentById(id: string): Promise<AssignmentDoc | null> {
  const snap = await getDoc(doc(db, 'assignments', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as AssignmentDoc) : null;
}

export async function createAssignment(data: Omit<AssignmentDoc, 'id'>): Promise<AssignmentDoc> {
  const ref = await addDoc(collection(db, 'assignments'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateAssignment(id: string, data: Partial<AssignmentDoc>): Promise<void> {
  await updateDoc(doc(db, 'assignments', id), data);
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', id));
}

function cleanData<T extends Record<string, any>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  ) as T;
}

/* ─── SUBMISSIONS ─────────────────────────────────────────── */
export interface SubmissionAttachment {
  name: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'file';
  size?: number;
}

export interface SubmissionDoc {
  id: string;
  assignmentId: string;
  assignmentTitle?: string;
  studentId: string;
  studentName?: string;
  textContent?: string;
  filePath?: string;
  filePaths?: string[];
  attachments?: SubmissionAttachment[];
  submittedAt: string;
  grade?: number;
  feedback?: string;
  rubricScores?: { criterionName: string; points: number }[];
  status?: 'SUBMITTED' | 'GRADED';
}

export async function getSubmissions(assignmentId?: string, studentId?: string): Promise<SubmissionDoc[]> {
  let col = collection(db, 'submissions');
  let q: any = col;
  if (assignmentId) q = query(col, where('assignmentId', '==', assignmentId));
  else if (studentId) q = query(col, where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubmissionDoc));
}

export async function getSubmissionByStudentAndAssignment(assignmentId: string, studentId: string): Promise<SubmissionDoc | null> {
  const q = query(
    collection(db, 'submissions'),
    where('assignmentId', '==', assignmentId),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as SubmissionDoc;
}

export async function createSubmission(data: Omit<SubmissionDoc, 'id'>): Promise<SubmissionDoc> {
  const cleaned = cleanData({
    ...data,
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString()
  });
  const ref = await addDoc(collection(db, 'submissions'), cleaned);
  return { id: ref.id, ...data };
}

export async function gradeSubmission(id: string, grade: number, feedback?: string, rubricScores?: any[]): Promise<void> {
  const updateData = cleanData({
    grade,
    feedback: feedback || '',
    rubricScores: rubricScores || [],
    status: 'GRADED',
    gradedAt: new Date().toISOString()
  });
  await updateDoc(doc(db, 'submissions', id), updateData);
}
