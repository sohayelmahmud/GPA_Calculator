import { useState, useCallback, useEffect } from 'react';
import type { AppData, GradingScheme, GradeScaleEntry, PreviousSemester } from '@shared/types';
import * as storage from '@/lib/storage';

export function useData() {
  const [data, setData] = useState<AppData>(() => storage.loadData());

  useEffect(() => {
    storage.saveData(data);
  }, [data]);

  const addSemester = useCallback((name: string) => {
    setData((d) => storage.addSemester(d, name));
  }, []);

  const updateSemester = useCallback((id: string, name: string) => {
    setData((d) => storage.updateSemester(d, id, name));
  }, []);

  const deleteSemester = useCallback((id: string) => {
    setData((d) => storage.deleteSemester(d, id));
  }, []);

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
      setData((d) =>
        storage.addCourse(d, semesterId, name, credits, hasLab, theoryCredits, labCredits, scheme),
      );
    },
    [],
  );

  const updateCourse = useCallback(
    (id: string, updates: Parameters<typeof storage.updateCourse>[2]) => {
      setData((d) => storage.updateCourse(d, id, updates));
    },
    [],
  );

  const deleteCourse = useCallback((id: string) => {
    setData((d) => storage.deleteCourse(d, id));
  }, []);

  const addMark = useCallback(
    (
      courseId: string,
      part: 'theory' | 'lab',
      kind: 'assignment' | 'quiz' | 'mid' | 'final',
      label: string | null,
      max: number,
      obtained?: number | null,
    ) => {
      setData((d) => storage.addMark(d, courseId, part, kind, label, max, obtained));
    },
    [],
  );

  const updateMark = useCallback(
    (id: string, updates: Parameters<typeof storage.updateMark>[2]) => {
      setData((d) => storage.updateMark(d, id, updates));
    },
    [],
  );

  const deleteMark = useCallback((id: string) => {
    setData((d) => storage.deleteMark(d, id));
  }, []);

  const updateGradeScale = useCallback(
    (scale: Omit<GradeScaleEntry, 'id' | 'user_id'>[]) => {
      setData((d) => storage.updateGradeScale(d, scale));
    },
    [],
  );

  const resetData = useCallback(() => {
    storage.clearAllData();
    setData(storage.loadData());
  }, []);

  const updatePreviousSemesters = useCallback((previousSemesters: PreviousSemester[]) => {
    setData((d) => storage.updatePreviousSemesters(d, previousSemesters));
  }, []);

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
    resetData,
    updatePreviousSemesters,
  };
}
