import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_GRADE_SCALE,
  type AppData,
  type GradeScaleEntry,
  type GradingScheme,
  type PreviousSemester,
} from '@shared/types';

const GUEST_STORAGE_KEY = 'gpa_calc_guest_v1';
const userCacheKey = (userId: string) => `gpa_calc_user_${userId}`;
const userQueueKey = (userId: string) => `gpa_calc_queue_${userId}`;

interface QueuedOp {
  id: string;
  path: string;
  method: string;
  body?: string;
}

function buildDefaultScale(): GradeScaleEntry[] {
  return DEFAULT_GRADE_SCALE.map((entry, idx) => ({
    id: `default-${idx}`,
    user_id: '',
    min_percent: entry.min_percent,
    grade_point: entry.grade_point,
    letter: entry.letter,
  }));
}

function createEmptyData(): AppData {
  return {
    semesters: [],
    courses: [],
    marks: [],
    gradeScale: buildDefaultScale(),
    previousSemesters: [],
  };
}

function normalizeAppData(raw: string | null): AppData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      semesters: Array.isArray(parsed.semesters) ? parsed.semesters : [],
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      gradeScale:
        Array.isArray(parsed.gradeScale) && parsed.gradeScale.length > 0
          ? parsed.gradeScale
          : buildDefaultScale(),
      previousSemesters: Array.isArray(parsed.previousSemesters) ? parsed.previousSemesters : [],
    };
  } catch {
    return null;
  }
}

export function loadGuestData(): AppData {
  try {
    return normalizeAppData(localStorage.getItem(GUEST_STORAGE_KEY)) ?? createEmptyData();
  } catch {
    return createEmptyData();
  }
}

export function clearGuestData() {
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function clearUserOfflineData(userId: string) {
  try {
    localStorage.removeItem(userCacheKey(userId));
    localStorage.removeItem(userQueueKey(userId));
  } catch {
    // ignore storage errors
  }
}

function loadUserCache(userId: string): AppData | null {
  try {
    return normalizeAppData(localStorage.getItem(userCacheKey(userId)));
  } catch {
    return null;
  }
}

function saveUserCache(userId: string, data: AppData) {
  try {
    localStorage.setItem(userCacheKey(userId), JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function loadQueue(userId: string): QueuedOp[] {
  try {
    const raw = localStorage.getItem(userQueueKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(userId: string, queue: QueuedOp[]) {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(userQueueKey(userId));
    } else {
      localStorage.setItem(userQueueKey(userId), JSON.stringify(queue));
    }
  } catch {
    // ignore storage errors
  }
}

export function hasGuestData(): boolean {
  const g = loadGuestData();
  return g.semesters.length > 0 || g.courses.length > 0 || g.previousSemesters.length > 0;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    const err = new Error(body?.error || 'Request failed') as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return response.status === 204 ? null : response.json();
}

export function useData(userId: string | null) {
  const isAuthenticated = Boolean(userId);
  const [data, setData] = useState<AppData>(() =>
    userId ? loadUserCache(userId) ?? createEmptyData() : loadGuestData(),
  );
  const canPersistGuest = useRef(!isAuthenticated);
  const syncingRef = useRef(false);

  const enqueueOp = useCallback((uid: string, op: Omit<QueuedOp, 'id'>) => {
    const current = loadQueue(uid);
    current.push({ id: uuidv4(), ...op });
    saveQueue(uid, current);
  }, []);

  const flushQueue = useCallback(async (uid: string) => {
    if (syncingRef.current) return;
    const queue = loadQueue(uid);
    if (queue.length === 0) return;

    syncingRef.current = true;
    try {
      while (true) {
        const current = loadQueue(uid);
        if (current.length === 0) break;
        const next = current[0];
        try {
          await apiRequest(next.path, {
            method: next.method,
            ...(next.body !== undefined ? { body: next.body } : {}),
          });
          // Remove synced item
          const updated = loadQueue(uid).filter((item) => item.id !== next.id);
          saveQueue(uid, updated);
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (status && status >= 400 && status < 500 && status !== 401) {
            // Drop invalid 4xx request (e.g., already deleted) so queue isn't blocked
            const updated = loadQueue(uid).filter((item) => item.id !== next.id);
            saveQueue(uid, updated);
          } else {
            // Network still offline or 401/5xx: stop and retry later
            break;
          }
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const sendOrQueue = useCallback(
    (uid: string, path: string, method: string, bodyObj?: unknown) => {
      const body = bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOp(uid, { path, method, body });
        return;
      }

      // If previous offline ops exist, preserve order by queueing behind them
      if (loadQueue(uid).length > 0) {
        enqueueOp(uid, { path, method, body });
        void flushQueue(uid);
        return;
      }

      void apiRequest(path, {
        method,
        ...(body !== undefined ? { body } : {}),
      }).catch((err: unknown) => {
        const status = (err as { status?: number })?.status;
        if (!status || status >= 500) {
          enqueueOp(uid, { path, method, body });
        }
      });
    },
    [enqueueOp, flushQueue],
  );

  // Sync guest changes or cache logged-in user changes to localStorage
  useEffect(() => {
    if (!userId) {
      if (!canPersistGuest.current) return;
      try {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
      return;
    }
    saveUserCache(userId, data);
  }, [data, userId]);

  // Load cloud data on login (after flushing pending offline ops), or guest data on logout
  useEffect(() => {
    if (!userId) {
      setData(loadGuestData());
      canPersistGuest.current = true;
      return;
    }

    canPersistGuest.current = false;
    const cached = loadUserCache(userId);
    if (cached) setData(cached);

    let cancelled = false;
    const syncAndFetch = async () => {
      await flushQueue(userId);
      try {
        const response = await fetch('/api/data', { credentials: 'include' });
        if (!response.ok) throw new Error('Unable to load data');
        const appData = (await response.json()) as AppData;
        if (!cancelled && loadQueue(userId).length === 0) {
          setData(appData);
          saveUserCache(userId, appData);
        }
      } catch {
        // Offline: keep cached user data if present
        if (!cancelled && !cached) {
          setData(createEmptyData());
        }
      }
    };

    void syncAndFetch();

    const handleOnline = () => {
      void syncAndFetch();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, flushQueue]);

  const addSemester = useCallback(
    (name: string) => {
      const id = uuidv4();
      setData((d) => ({
        ...d,
        semesters: [...d.semesters, { id, user_id: '', name, sort_order: d.semesters.length }],
      }));
      if (userId) {
        sendOrQueue(userId, '/api/semesters', 'POST', { id, name });
      }
    },
    [userId, sendOrQueue],
  );

  const updateSemester = useCallback(
    (id: string, name: string) => {
      setData((d) => ({
        ...d,
        semesters: d.semesters.map((semester) =>
          semester.id === id ? { ...semester, name } : semester,
        ),
      }));
      if (userId) {
        sendOrQueue(userId, `/api/semesters/${encodeURIComponent(id)}`, 'PUT', { name });
      }
    },
    [userId, sendOrQueue],
  );

  const deleteSemester = useCallback(
    (id: string) => {
      setData((d) => {
        const courseIds = d.courses
          .filter((course) => course.semester_id === id)
          .map((course) => course.id);
        return {
          ...d,
          semesters: d.semesters.filter((semester) => semester.id !== id),
          courses: d.courses.filter((course) => course.semester_id !== id),
          marks: d.marks.filter((mark) => !courseIds.includes(mark.course_id)),
        };
      });
      if (userId) {
        sendOrQueue(userId, `/api/semesters/${encodeURIComponent(id)}`, 'DELETE');
      }
    },
    [userId, sendOrQueue],
  );

  const addCourse = useCallback(
    (
      semesterId: string,
      name: string,
      credits: number,
      hasLab: boolean,
      theoryCredits: number | null,
      labCredits: number | null,
      scheme: GradingScheme,
    ) => {
      const id = uuidv4();
      setData((d) => ({
        ...d,
        courses: [
          ...d.courses,
          {
            id,
            user_id: '',
            semester_id: semesterId,
            name,
            credits,
            has_lab: hasLab,
            theory_credits: theoryCredits,
            lab_credits: labCredits,
            scheme,
          },
        ],
      }));
      if (userId) {
        sendOrQueue(userId, '/api/courses', 'POST', {
          id,
          semester_id: semesterId,
          name,
          credits,
          has_lab: hasLab,
          theory_credits: theoryCredits,
          lab_credits: labCredits,
          scheme,
        });
      }
    },
    [userId, sendOrQueue],
  );

  const updateCourse = useCallback(
    (
      id: string,
      updates: {
        name?: string;
        credits?: number;
        has_lab?: boolean;
        theory_credits?: number | null;
        lab_credits?: number | null;
        scheme?: GradingScheme;
      },
    ) => {
      setData((d) => ({
        ...d,
        courses: d.courses.map((course) =>
          course.id === id ? { ...course, ...updates } : course,
        ),
      }));
      if (userId) {
        sendOrQueue(userId, `/api/courses/${encodeURIComponent(id)}`, 'PUT', updates);
      }
    },
    [userId, sendOrQueue],
  );

  const deleteCourse = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        courses: d.courses.filter((course) => course.id !== id),
        marks: d.marks.filter((mark) => mark.course_id !== id),
      }));
      if (userId) {
        sendOrQueue(userId, `/api/courses/${encodeURIComponent(id)}`, 'DELETE');
      }
    },
    [userId, sendOrQueue],
  );

  const addMark = useCallback(
    (
      courseId: string,
      part: 'theory' | 'lab',
      kind: 'assignment' | 'quiz' | 'mid' | 'final',
      label: string | null,
      max: number,
      obtained?: number | null,
    ) => {
      const id = uuidv4();
      setData((d) => ({
        ...d,
        marks: [
          ...d.marks,
          {
            id,
            user_id: '',
            course_id: courseId,
            part,
            kind,
            label,
            obtained: obtained ?? null,
            max,
            sort_order: d.marks.filter(
              (mark) => mark.course_id === courseId && mark.part === part && mark.kind === kind,
            ).length,
          },
        ],
      }));
      if (userId) {
        sendOrQueue(userId, '/api/marks', 'POST', {
          id,
          course_id: courseId,
          part,
          kind,
          label,
          obtained: obtained ?? null,
          max,
        });
      }
    },
    [userId, sendOrQueue],
  );

  const updateMark = useCallback(
    (id: string, updates: { label?: string | null; obtained?: number | null; max?: number }) => {
      setData((d) => ({
        ...d,
        marks: d.marks.map((mark) => (mark.id === id ? { ...mark, ...updates } : mark)),
      }));
      if (userId) {
        sendOrQueue(userId, `/api/marks/${encodeURIComponent(id)}`, 'PUT', updates);
      }
    },
    [userId, sendOrQueue],
  );

  const deleteMark = useCallback(
    (id: string) => {
      setData((d) => ({
        ...d,
        marks: d.marks.filter((mark) => mark.id !== id),
      }));
      if (userId) {
        sendOrQueue(userId, `/api/marks/${encodeURIComponent(id)}`, 'DELETE');
      }
    },
    [userId, sendOrQueue],
  );

  const updateGradeScale = useCallback(
    (scale: Omit<GradeScaleEntry, 'id' | 'user_id'>[]) => {
      setData((d) => ({
        ...d,
        gradeScale: scale.map((entry) => ({ ...entry, id: uuidv4(), user_id: '' })),
      }));
      if (userId) {
        sendOrQueue(userId, '/api/grade-scale', 'PUT', scale);
      }
    },
    [userId, sendOrQueue],
  );

  const resetGradeScale = useCallback(() => {
    setData((d) => ({
      ...d,
      gradeScale: buildDefaultScale(),
    }));
    if (userId) {
      sendOrQueue(userId, '/api/grade-scale', 'DELETE');
    }
  }, [userId, sendOrQueue]);

  const resetData = useCallback(() => {
    if (!userId) {
      clearGuestData();
    } else {
      clearUserOfflineData(userId);
    }
    setData(createEmptyData());
  }, [userId]);

  const updatePreviousSemesters = useCallback(
    (previousSemesters: PreviousSemester[]) => {
      setData((d) => ({ ...d, previousSemesters }));
      if (userId) {
        sendOrQueue(userId, '/api/previous-semesters', 'PUT', previousSemesters);
      }
    },
    [userId, sendOrQueue],
  );

  return {
    data,
    addSemester,
    updateSemester,
    deleteSemester,
    addCourse,
    updateCourse,
    deleteCourse,
    addMark,
    updateMark,
    deleteMark,
    updateGradeScale,
    resetGradeScale,
    resetData,
    updatePreviousSemesters,
  };
}