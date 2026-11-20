// ─── Core data types ───

export interface Semester {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
}

export interface GradingScheme {
  theory: { assignment: number; quiz: number; mid: number; final: number };
  lab?: { assignment: number; quiz: number; mid: number; final: number };
}

export interface Course {
  id: string;
  user_id: string;
  semester_id: string;
  name: string;
  credits: number;
  has_lab: boolean;
  theory_credits: number | null;
  lab_credits: number | null;
  scheme: GradingScheme;
}

export type MarkPart = 'theory' | 'lab';
export type MarkKind = 'assignment' | 'quiz' | 'mid' | 'final';

export interface Mark {
  id: string;
  user_id: string;
  course_id: string;
  part: MarkPart;
  kind: MarkKind;
  label: string | null;
  obtained: number | null; // null = not taken yet
  max: number;
  sort_order: number;
}

export interface GradeScaleEntry {
  id: string;
  user_id: string;
  min_percent: number;
  grade_point: number;
  letter: string;
}

// ─── Computed results ───

export interface ComponentResult {
  kind: MarkKind;
  weight: number;
  score: number | null; // null = no items entered
  graded: boolean;
}

export interface PartResult {
  part: MarkPart;
  percent: number | null;
  complete: boolean;
  components: ComponentResult[];
}

export interface CourseResult {
  courseId: string;
  theoryResult: PartResult;
  labResult: PartResult | null;
  coursePercent: number | null;
  provisional: boolean;
  gradePoint: number | null;
  letter: string | null;
}

export interface SemesterResult {
  semesterId: string;
  sgpa: number | null;
  totalCredits: number;
  provisional: boolean;
  courses: CourseResult[];
}

export interface PreviousSemester {
  id: string;
  name: string;
  credits: number;
  sgpa: number;
}

// ─── App data bundle ───

export interface AppData {
  semesters: Semester[];
  courses: Course[];
  marks: Mark[];
  gradeScale: GradeScaleEntry[];
  previousSemesters: PreviousSemester[];
}

// ─── Scheme presets ───

export const SCHEME_PRESETS = {
  standardTheory: { assignment: 10, quiz: 15, mid: 25, final: 50 },
  noAssignmentQuiz: { assignment: 0, quiz: 0, mid: 25, final: 75 },
  standardLab: { assignment: 25, quiz: 0, mid: 25, final: 50 },
} as const;

// ─── Default grade scale ───

export const DEFAULT_GRADE_SCALE: Omit<GradeScaleEntry, 'id' | 'user_id'>[] = [
  { min_percent: 85, grade_point: 4.00, letter: 'A' },
  { min_percent: 80, grade_point: 3.66, letter: 'A-' },
  { min_percent: 75, grade_point: 3.33, letter: 'B+' },
  { min_percent: 71, grade_point: 3.00, letter: 'B' },
  { min_percent: 68, grade_point: 2.66, letter: 'B-' },
  { min_percent: 64, grade_point: 2.33, letter: 'C+' },
  { min_percent: 61, grade_point: 2.00, letter: 'C' },
  { min_percent: 58, grade_point: 1.67, letter: 'C-' },
  { min_percent: 54, grade_point: 1.33, letter: 'D+' },
  { min_percent: 50, grade_point: 1.00, letter: 'D' },
  { min_percent: 0, grade_point: 0.00, letter: 'F' },
];
