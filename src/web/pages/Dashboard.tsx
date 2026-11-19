import { useState } from 'react';
import type {
  AppData,
  Course,
  GradingScheme,
  MarkKind,
  MarkPart,
  PreviousSemester,
} from '@shared/types';
import { computeSemester, computeCGPA, round2 } from '@shared/grade';
import CourseForm from '@/components/CourseForm';
import { DetailedCourseCard } from '@/components/CourseCards';
import { PreviousSemesterCard, StatCard } from '@/components/StatCards';

interface Props {
  data: AppData;
  addSemester: (name: string) => void;
  updateSemester: (id: string, name: string) => void;
  deleteSemester: (id: string) => void;
  addCourse: (
    semesterId: string,
    name: string,
    credits: number,
    hasLab: boolean,
    theoryCredits: number | null,
    labCredits: number | null,
    scheme: GradingScheme,
  ) => void;
  updateCourse: (
    id: string,
    updates: Partial<Omit<Course, 'id' | 'user_id'>>,
  ) => void;
  deleteCourse: (id: string) => void;
  addMark: (
    courseId: string,
    part: MarkPart,
    kind: MarkKind,
    label: string | null,
    max: number,
    obtained?: number | null,
  ) => void;
  updateMark: (
    id: string,
    updates: { label?: string | null; obtained?: number | null; max?: number },
  ) => void;
  deleteMark: (id: string) => void;
  updatePreviousSemesters: (previousSemesters: PreviousSemester[]) => void;
}

export default function Dashboard({
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
  updatePreviousSemesters,
}: Props) {
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(
    () => data.semesters[0]?.id ?? null,
  );
  const [newSemName, setNewSemName] = useState('');
  const [showSemForm, setShowSemForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingSemId, setEditingSemId] = useState<string | null>(null);
  const [editingSemName, setEditingSemName] = useState('');
  const [confirmDeleteSem, setConfirmDeleteSem] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<{ id: string; name: string } | null>(null);

  const selectedSemester =
    data.semesters.find((s) => s.id === selectedSemesterId) ?? data.semesters[0] ?? null;

  const cgpaResult = computeCGPA(
    data.semesters,
    data.courses,
    data.marks,
    data.gradeScale,
    data.previousSemesters ?? [],
  );

  const semResult = selectedSemester
    ? computeSemester(selectedSemester, data.courses, data.marks, data.gradeScale)
    : null;

  const handleAddSemester = () => {
    if (!newSemName.trim()) return;
    addSemester(newSemName.trim());
    setNewSemName('');
    setShowSemForm(false);
  };

  const handleAddCourse = (
    name: string,
    credits: number,
    hasLab: boolean,
    theoryCredits: number | null,
    labCredits: number | null,
    scheme: GradingScheme,
  ) => {
    if (!selectedSemester) return;
    addCourse(selectedSemester.id, name, credits, hasLab, theoryCredits, labCredits, scheme);
    setShowCourseForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <StatCard
            label="CGPA"
            value={cgpaResult.cgpa !== null ? round2(cgpaResult.cgpa).toFixed(2) : '—'}
            provisional={cgpaResult.provisional}
            subtitle={`${cgpaResult.totalCredits} total credits`}
          />
        </div>
        {semResult && (
          <div className="sm:col-span-1">
            <StatCard
              label="SGPA"
              value={semResult.sgpa !== null ? round2(semResult.sgpa).toFixed(2) : '—'}
              provisional={semResult.provisional}
              subtitle={selectedSemester?.name}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <PreviousSemesterCard
            previousSemesters={data.previousSemesters ?? []}
            updatePreviousSemesters={updatePreviousSemesters}
          />
        </div>
      </div>

      {/* Semester pills */}
      <div className="flex flex-wrap items-center gap-2">
        {data.semesters.map((sem) => (
          <div key={sem.id} className="relative group inline-flex items-center">
            {editingSemId === sem.id ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingSemName.trim()) updateSemester(sem.id, editingSemName.trim());
                  setEditingSemId(null);
                }}
              >
                <input
                  className="border rounded px-2 py-1 text-sm w-28"
                  value={editingSemName}
                  onChange={(e) => setEditingSemName(e.target.value)}
                  autoFocus
                  onBlur={() => {
                    if (editingSemName.trim()) updateSemester(sem.id, editingSemName.trim());
                    setEditingSemId(null);
                  }}
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedSemesterId(sem.id)}
                onDoubleClick={() => {
                  setEditingSemId(sem.id);
                  setEditingSemName(sem.name);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${selectedSemester?.id === sem.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-400'
                  }`}
              >
                {sem.name}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                // Open custom confirmation modal instead of deleting immediately
                e.stopPropagation();
                setConfirmDeleteSem({ id: sem.id, name: sem.name });
              }}
              className="absolute -top-1.5 -right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition cursor-pointer"
              title="Delete semester"
            >
              ×
            </button>
          </div>
        ))}
        {showSemForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSemester();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="e.g. Fall 2026"
              value={newSemName}
              onChange={(e) => setNewSemName(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-32"
              autoFocus
            />
            <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
              Add
            </button>
            <button type="button" onClick={() => setShowSemForm(false)} className="text-gray-400 hover:text-gray-600 text-sm">
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowSemForm(true)}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-gray-400 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition"
          >
            + Semester
          </button>
        )}
      </div>

      {/* Course cards */}
      {selectedSemester && semResult ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{selectedSemester.name}</h2>

          {semResult.courses.length === 0 && !showCourseForm ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">No courses yet</p>
              <p className="text-sm mb-4">Add your first course to start tracking grades</p>
              <button
                onClick={() => setShowCourseForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
              >
                + Add Course
              </button>
            </div>
          ) : (
            <>
              <div className="grid min-w-0 grid-cols-1 grid-flow-row-dense gap-4 lg:grid-cols-3">
                {semResult.courses.map((cr) => {
                  const course = data.courses.find((c) => c.id === cr.courseId);
                  if (!course) return null;
                  return (
                    <div
                      key={course.id}
                      className={`min-w-0 ${course.has_lab ? 'lg:col-span-2' : 'lg:col-span-1'}`}
                    >
                      <DetailedCourseCard
                        course={course}
                        data={data}
                        result={cr}
                        updateCourse={updateCourse}
                        onRequestDeleteCourse={() =>
                          setConfirmDeleteCourse({ id: course.id, name: course.name })
                        }
                        addMark={addMark}
                        updateMark={updateMark}
                        deleteMark={deleteMark}
                        editing={editingCourseId === course.id}
                        onStartEdit={() => {
                          setEditingCourseId(course.id);
                          setShowCourseForm(false);
                        }}
                        onStopEdit={() => setEditingCourseId(null)}
                      />
                    </div>
                  );
                })}
              </div>

              {showCourseForm ? (
                <CourseForm onSubmit={handleAddCourse} onCancel={() => setShowCourseForm(false)} />
              ) : (
                <button
                  onClick={() => setShowCourseForm(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition text-sm font-medium"
                >
                  + Add Course
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        !selectedSemester && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg mb-2">Welcome to GPA Calculator</p>
            <p className="text-sm">Start by adding a semester above</p>
          </div>
        )
      )}

      {confirmDeleteSem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Delete semester?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-medium text-gray-900">"{confirmDeleteSem.name}"</span> and all its courses?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteSem(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Delete semester and fall back to first remaining semester if needed
                  const targetId = confirmDeleteSem.id;
                  const remaining = data.semesters.filter((s) => s.id !== targetId);
                  deleteSemester(targetId);
                  if (selectedSemesterId === targetId) {
                    setSelectedSemesterId(remaining[0]?.id ?? null);
                  }
                  setConfirmDeleteSem(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Delete course?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-medium text-gray-900">"{confirmDeleteCourse.name}"</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCourse(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Delete selected course and close confirmation modal
                  deleteCourse(confirmDeleteCourse.id);
                  if (editingCourseId === confirmDeleteCourse.id) {
                    setEditingCourseId(null);
                  }
                  setConfirmDeleteCourse(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

