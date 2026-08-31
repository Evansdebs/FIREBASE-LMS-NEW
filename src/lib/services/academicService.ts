/**
 * academicService.ts
 * Firestore CRUD for Classes, Subjects, Courses, Topics.
 */
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* ─── CLASSES ─────────────────────────────────────────────── */
export interface ClassDoc {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export async function getClasses(): Promise<ClassDoc[]> {
  const snap = await getDocs(collection(db, 'classes'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassDoc));
}

export async function getClassById(id: string): Promise<ClassDoc | null> {
  const snap = await getDoc(doc(db, 'classes', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ClassDoc) : null;
}

export async function createClass(data: Omit<ClassDoc, 'id'>): Promise<ClassDoc> {
  const ref = await addDoc(collection(db, 'classes'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateClass(id: string, data: Partial<ClassDoc>): Promise<void> {
  await updateDoc(doc(db, 'classes', id), data);
}

export async function deleteClass(id: string): Promise<void> {
  await deleteDoc(doc(db, 'classes', id));
}

/* ─── SUBJECTS ─────────────────────────────────────────────── */
export interface SubjectDoc {
  id: string;
  name: string;
  description?: string;
  classId: string;
  className?: string;
  createdAt?: string;
}

export async function getSubjects(classId?: string): Promise<SubjectDoc[]> {
  const col = collection(db, 'subjects');
  const q = classId ? query(col, where('classId', '==', classId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SubjectDoc));
}

export async function createSubject(data: Omit<SubjectDoc, 'id'>): Promise<SubjectDoc> {
  const ref = await addDoc(collection(db, 'subjects'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateSubject(id: string, data: Partial<SubjectDoc>): Promise<void> {
  await updateDoc(doc(db, 'subjects', id), data);
}

export async function deleteSubject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'subjects', id));
}

/* ─── COURSES ─────────────────────────────────────────────── */
export interface CourseDoc {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName?: string;
  classIds?: string[];
  teacherIds?: string[];
  createdAt?: string;
}

export async function getCourses(subjectId?: string): Promise<CourseDoc[]> {
  const col = collection(db, 'courses');
  const q = subjectId ? query(col, where('subjectId', '==', subjectId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseDoc));
}

export async function getCourseById(id: string): Promise<CourseDoc | null> {
  const snap = await getDoc(doc(db, 'courses', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as CourseDoc) : null;
}

export async function getCoursesForTeacher(teacherId: string): Promise<CourseDoc[]> {
  const q = query(collection(db, 'courses'), where('teacherIds', 'array-contains', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseDoc));
}

export async function getCoursesForClass(classId: string): Promise<CourseDoc[]> {
  const q = query(collection(db, 'courses'), where('classIds', 'array-contains', classId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseDoc));
}

export async function createCourse(data: Omit<CourseDoc, 'id'>): Promise<CourseDoc> {
  const ref = await addDoc(collection(db, 'courses'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateCourse(id: string, data: Partial<CourseDoc>): Promise<void> {
  await updateDoc(doc(db, 'courses', id), data);
}

export async function deleteCourse(id: string): Promise<void> {
  await deleteDoc(doc(db, 'courses', id));
}

/* ─── TOPICS ─────────────────────────────────────────────── */
export interface TopicDoc {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt?: string;
}

export async function getTopics(courseId: string): Promise<TopicDoc[]> {
  const q = query(
    collection(db, 'topics'),
    where('courseId', '==', courseId),
    orderBy('orderIndex')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TopicDoc));
}

export async function createTopic(data: Omit<TopicDoc, 'id'>): Promise<TopicDoc> {
  const ref = await addDoc(collection(db, 'topics'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateTopic(id: string, data: Partial<TopicDoc>): Promise<void> {
  await updateDoc(doc(db, 'topics', id), data);
}

export async function deleteTopic(id: string): Promise<void> {
  await deleteDoc(doc(db, 'topics', id));
}

/* ─── TIMETABLE ─────────────────────────────────────────────── */
export interface TimetableEntry {
  id: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
}

export async function getTimetable(classId: string): Promise<TimetableEntry[]> {
  const q = query(collection(db, 'timetable'), where('classId', '==', classId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableEntry));
}

export async function createTimetableEntry(data: Omit<TimetableEntry, 'id'>): Promise<TimetableEntry> {
  const ref = await addDoc(collection(db, 'timetable'), { ...data, createdAt: new Date().toISOString() });
  return { id: ref.id, ...data };
}

export async function updateTimetableEntry(id: string, data: Partial<TimetableEntry>): Promise<void> {
  await updateDoc(doc(db, 'timetable', id), data);
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'timetable', id));
}
