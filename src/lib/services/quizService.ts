/**
 * quizService.ts
 * Firestore CRUD for Quizzes, Questions, Options, and Attempts.
 */
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── QUIZ ────────────────────────────────────────────────── */
export interface QuizDoc {
  id: string;
  courseId: string;
  courseTitle?: string;
  title: string;
  duration: number;
  instructions?: string;
  isPublished: boolean;
  attemptLimit: number;
  dueDate?: string;
  createdBy: string;
  createdByName?: string;
  classIds?: string[];
  createdAt?: string;
}

export async function getQuizzes(courseId?: string): Promise<QuizDoc[]> {
  const col = collection(db, 'quizzes');
  const q = courseId ? query(col, where('courseId', '==', courseId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizDoc));
}

export async function getPublishedQuizzesForClass(classId: string): Promise<QuizDoc[]> {
  const q = query(
    collection(db, 'quizzes'),
    where('classIds', 'array-contains', classId),
    where('isPublished', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizDoc));
}

export async function getQuizById(id: string): Promise<QuizDoc | null> {
  const snap = await getDoc(doc(db, 'quizzes', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as QuizDoc) : null;
}

export async function createQuiz(data: Omit<QuizDoc, 'id'>): Promise<QuizDoc> {
  const ref = await addDoc(collection(db, 'quizzes'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateQuiz(id: string, data: Partial<QuizDoc>): Promise<void> {
  await updateDoc(doc(db, 'quizzes', id), data);
}

export async function deleteQuiz(id: string): Promise<void> {
  await deleteDoc(doc(db, 'quizzes', id));
}

/* ─── QUESTIONS & OPTIONS ─────────────────────────────────── */
export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  points: number;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
}

export async function getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  const q = query(collection(db, 'quiz_questions'), where('quizId', '==', quizId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizQuestion));
}

export async function createQuizQuestion(data: Omit<QuizQuestion, 'id'>): Promise<QuizQuestion> {
  const ref = await addDoc(collection(db, 'quiz_questions'), data);
  return { id: ref.id, ...data };
}

export async function updateQuizQuestion(id: string, data: Partial<QuizQuestion>): Promise<void> {
  await updateDoc(doc(db, 'quiz_questions', id), data);
}

export async function deleteQuizQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, 'quiz_questions', id));
}

/* ─── ATTEMPTS ─────────────────────────────────────────────── */
export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle?: string;
  studentId: string;
  studentName?: string;
  score: number;
  total: number;
  percentage?: number;
  answers: { questionId: string; selectedOptionId: string; isCorrect: boolean }[];
  submittedAt: string;
}

export async function getQuizAttempts(quizId?: string, studentId?: string): Promise<QuizAttempt[]> {
  let q = query(collection(db, 'quiz_attempts'));
  if (quizId) q = query(q, where('quizId', '==', quizId));
  if (studentId) q = query(q, where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as QuizAttempt));
}

export async function createQuizAttempt(data: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt> {
  const ref = await addDoc(collection(db, 'quiz_attempts'), { ...data, submittedAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}
