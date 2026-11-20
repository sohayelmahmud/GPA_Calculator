import type {
  Mark,
  MarkKind,
  MarkPart,
  Course,
  GradeScaleEntry,
  ComponentResult,
  PartResult,
  CourseResult,
  SemesterResult,
  Semester,
} from './types';

const KINDS: MarkKind[] = ['assignment', 'quiz', 'mid', 'final'];

/**
 * Compute a single component (assignment / quiz / mid / final) score.
 *
 * - assignment & quiz: average of (obtained/max) ratios for entered items, × weight
 * - mid & final: single ratio × weight
 * - Items with obtained === null are skipped.
 */
export function computeComponent(
  marks: Mark[],
  kind: MarkKind,
  weight: number,
): ComponentResult {
  const items = marks.filter((m) => m.kind === kind && m.obtained !== null);

  if (items.length === 0 || weight === 0) {
    return { kind, weight, score: null, graded: items.length > 0 && weight > 0 };
  }

  if (kind === 'assignment' || kind === 'quiz') {
    const ratios = items
      .filter((m) => m.max > 0)
      .map((m) => m.obtained! / m.max);
    if (ratios.length === 0) {
      return { kind, weight, score: null, graded: false };
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return { kind, weight, score: avg * weight, graded: true };
  }

  // mid or final — use the first entered item
  const item = items[0];
  if (item.max <= 0) {
    return { kind, weight, score: null, graded: false };
  }
  const ratio = item.obtained! / item.max;
  return { kind, weight, score: ratio * weight, graded: true };
}

/**
 * Compute a part (theory or lab) percentage.
 */
export function computePart(
  marks: Mark[],
  part: MarkPart,
  weights: { assignment: number; quiz: number; mid: number; final: number },
): PartResult {
  const partMarks = marks.filter((m) => m.part === part);
  const components = KINDS.map((kind) =>
    computeComponent(partMarks, kind, weights[kind]),
  );

  const graded = components.filter((c) => c.graded);
  if (graded.length === 0) {
    return { part, percent: null, complete: false, components };
  }

  const earned = graded.reduce((sum, c) => sum + (c.score ?? 0), 0);
  const possible = graded.reduce((sum, c) => sum + c.weight, 0);
  const percent = (earned / possible) * 100;

  // Complete when every component with weight > 0 is graded
  const complete = components.every((c) => c.weight === 0 || c.graded);

  return { part, percent, complete, components };
}

/**
 * Compute course percentage, grade point and letter.
 */
export function computeCourse(
  course: Course,
  marks: Mark[],
  gradeScale: GradeScaleEntry[],
): CourseResult {
  const courseMarks = marks.filter((m) => m.course_id === course.id);
  const scheme = course.scheme;

  const theoryResult = computePart(courseMarks, 'theory', scheme.theory);

  let labResult: PartResult | null = null;
  if (course.has_lab && scheme.lab) {
    labResult = computePart(courseMarks, 'lab', scheme.lab);
  }

  let coursePercent: number | null = null;
  let provisional = false;

  if (!course.has_lab || !labResult) {
    // No lab
    coursePercent = theoryResult.percent;
    provisional = theoryResult.percent !== null && !theoryResult.complete;
  } else {
    // Has lab
    const theoryCredits = course.theory_credits ?? course.credits;
    const labCredits = course.lab_credits ?? 0;
    const totalCredits = course.credits;

    if (theoryResult.percent !== null && labResult.percent !== null) {
      coursePercent =
        totalCredits > 0
          ? theoryResult.percent * (theoryCredits / totalCredits) +
          labResult.percent * (labCredits / totalCredits)
          : (theoryResult.percent + labResult.percent) / 2;
      provisional = !theoryResult.complete || !labResult.complete;
    } else if (theoryResult.percent !== null) {
      coursePercent = theoryResult.percent;
      provisional = true;
    } else if (labResult.percent !== null) {
      coursePercent = labResult.percent;
      provisional = true;
    }
  }

  let gradePoint: number | null = null;
  let letter: string | null = null;

  if (coursePercent !== null) {
    const rounded = Math.round(coursePercent * 100) / 100;
    // Sort scale descending by min_percent
    const sorted = [...gradeScale].sort((a, b) => b.min_percent - a.min_percent);
    for (const entry of sorted) {
      if (rounded >= entry.min_percent) {
        gradePoint = entry.grade_point;
        letter = entry.letter;
        break;
      }
    }
  }

  return {
    courseId: course.id,
    theoryResult,
    labResult,
    coursePercent,
    provisional,
    gradePoint,
    letter,
  };
}

/**
 * Compute SGPA for a semester.
 */
export function computeSemester(
  semester: Semester,
  courses: Course[],
  marks: Mark[],
  gradeScale: GradeScaleEntry[],
): SemesterResult {
  const semCourses = courses.filter((c) => c.semester_id === semester.id);
  const courseResults = semCourses.map((c) => computeCourse(c, marks, gradeScale));

  const gradedCourses = courseResults.filter((cr) => cr.coursePercent !== null);

  let sgpa: number | null = null;
  let totalCredits = 0;
  let provisional = false;

  if (gradedCourses.length > 0) {
    let weightedSum = 0;
    let creditSum = 0;
    for (const cr of gradedCourses) {
      const course = semCourses.find((c) => c.id === cr.courseId)!;
      if (course.credits > 0) {
        weightedSum += (cr.gradePoint ?? 0) * course.credits;
        creditSum += course.credits;
        if (cr.provisional) provisional = true;
      }
    }
    sgpa = creditSum > 0 ? weightedSum / creditSum : null;
    totalCredits = creditSum;
  }

  return {
    semesterId: semester.id,
    sgpa,
    totalCredits,
    provisional,
    courses: courseResults,
  };
}

/**
 * Compute CGPA across all semesters.
 */
export function computeCGPA(
  semesters: Semester[],
  courses: Course[],
  marks: Mark[],
  gradeScale: GradeScaleEntry[],
  previousSemesters: { credits: number; sgpa: number }[] = [],
): { cgpa: number | null; totalCredits: number; provisional: boolean } {
  const semResults = semesters.map((s) =>
    computeSemester(s, courses, marks, gradeScale),
  );

  let weightedSum = 0;
  let creditSum = 0;
  let provisional = false;

  for (const previous of previousSemesters) {
    if (previous.credits > 0 && Number.isFinite(previous.sgpa)) {
      weightedSum += previous.sgpa * previous.credits;
      creditSum += previous.credits;
    }
  }

  for (const sr of semResults) {
    if (sr.sgpa !== null) {
      for (const cr of sr.courses) {
        if (cr.coursePercent !== null) {
          const course = courses.find((c) => c.id === cr.courseId)!;
          if (course.credits > 0) {
            weightedSum += (cr.gradePoint ?? 0) * course.credits;
            creditSum += course.credits;
            if (cr.provisional) provisional = true;
          }
        }
      }
    }
  }

  return {
    cgpa: creditSum > 0 ? weightedSum / creditSum : null,
    totalCredits: creditSum,
    provisional,
  };
}

/**
 * Round a number to 2 decimal places for display.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}