import { v4 as uuidv4 } from 'uuid';
import type { AppData, Semester, Course, Mark, GradeScaleEntry, GradingScheme, PreviousSemester } from '@shared/types';
import { DEFAULT_GRADE_SCALE } from '@shared/types';

const STORAGE_KEY = 'cgpa-calculator-data';
const USER_ID = 'local-user';

function generateId(): string {
  return uuidv4();
}

function getDefaultData(): AppData {
  return {
    semesters: [],
    courses: [],
    marks: [],
    previousSemesters: [],
    gradeScale: DEFAULT_GRADE_SCALE.map((entry) => ({
      ...entry,
      id: generateId(),
      user_id: USER_ID,
    })),
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const data = JSON.parse(raw) as Partial<AppData>;
    return {
      ...getDefaultData(),
      ...data,
      previousSemesters: Array.isArray(data.previousSemesters)
        ? data.previousSemesters.filter(
            (semester): semester is PreviousSemester =>
              typeof semester?.credits === 'number' &&
              Number.isInteger(semester.credits) &&
              typeof semester?.sgpa === 'number' &&
              Number.isFinite(semester.sgpa),
          )
        : [],
    };
  } catch {
    return getDefaultData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addSemester(data: AppData, name: string): AppData {
  const semester: Semester = {
    id: generateId(),
    user_id: USER_ID,
    name,
    sort_order: data.semesters.length,
  };
  return { ...data, semesters: [...data.semesters, semester] };
}

export function updateSemester(data: AppData, id: string, name: string): AppData {
  return {
    ...data,
    semesters: data.semesters.map((s) => (s.id === id ? { ...s, name } : s)),
  };
}

export function deleteSemester(data: AppData, id: string): AppData {
  const courseIds = data.courses.filter((c) => c.semester_id === id).map((c) => c.id);
  return {
    ...data,
    semesters: data.semesters.filter((s) => s.id !== id),
    courses: data.courses.filter((c) => c.semester_id !== id),
    marks: data.marks.filter((m) => !courseIds.includes(m.course_id)),
  };
}

export function addCourse(
  data: AppData,
  semesterId: string,
  name: string,
  credits: number,
  hasLab: boolean,
  theoryCredits: number | null,
  labCredits: number | null,
  scheme: GradingScheme,
): AppData {
  const course: Course = {
    id: generateId(),
    user_id: USER_ID,
    semester_id: semesterId,
    name,
    credits,
    has_lab: hasLab,
    theory_credits: theoryCredits,
    lab_credits: labCredits,
    scheme,
  };
  return { ...data, courses: [...data.courses, course] };
}

export function updateCourse(
  data: AppData,
  id: string,
  updates: Partial<Omit<Course, 'id' | 'user_id'>>,
): AppData {
  return {
    ...data,
    courses: data.courses.map((c) => (c.id === id ? { ...c, ...updates } : c)),
  };
}

export function deleteCourse(data: AppData, id: string): AppData {
  return {
    ...data,
    courses: data.courses.filter((c) => c.id !== id),
    marks: data.marks.filter((m) => m.course_id !== id),
  };
}

export function addMark(
  data: AppData,
  courseId: string,
  part: 'theory' | 'lab',
  kind: 'assignment' | 'quiz' | 'mid' | 'final',
  label: string | null,
  max: number,
  obtained?: number | null,
): AppData {
  const mark: Mark = {
    id: generateId(),
    user_id: USER_ID,
    course_id: courseId,
    part,
    kind,
    label,
    obtained: obtained ?? null,
    max,
    sort_order: data.marks.filter(
      (m) => m.course_id === courseId && m.part === part && m.kind === kind,
    ).length,
  };
  return { ...data, marks: [...data.marks, mark] };
}

export function updateMark(
  data: AppData,
  id: string,
  updates: Partial<Omit<Mark, 'id' | 'user_id'>>,
): AppData {
  return {
    ...data,
    marks: data.marks.map((m) => (m.id === id ? { ...m, ...updates } : m)),
  };
}

export function deleteMark(data: AppData, id: string): AppData {
  return {
    ...data,
    marks: data.marks.filter((m) => m.id !== id),
  };
}

export function updateGradeScale(
  data: AppData,
  scale: Omit<GradeScaleEntry, 'id' | 'user_id'>[],
): AppData {
  return {
    ...data,
    gradeScale: scale.map((entry) => ({
      ...entry,
      id: generateId(),
      user_id: USER_ID,
    })),
  };
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function updatePreviousSemesters(
  data: AppData,
  previousSemesters: PreviousSemester[],
): AppData {
  return { ...data, previousSemesters };
}
