import { useState } from 'react';
import type { AppData, Course, CourseResult, MarkKind, MarkPart } from '@shared/types';
import { round2 } from '@shared/grade';
import CourseForm from '@/components/CourseForm';

interface DetailedCourseCardProps {
  course: Course;
  data: AppData;
  result: CourseResult;
  updateCourse: (id: string, updates: Partial<Omit<Course, 'id' | 'user_id'>>) => void;
  onRequestDeleteCourse: () => void;
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
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}

const markKinds: MarkKind[] = ['assignment', 'quiz', 'mid', 'final'];

export function DetailedCourseCard({
  course,
  data,
  result,
  updateCourse,
  onRequestDeleteCourse,
  addMark,
  updateMark,
  deleteMark,
  editing,
  onStartEdit,
  onStopEdit,
}: DetailedCourseCardProps) {
  const [addingMark, setAddingMark] = useState<{ part: MarkPart; kind: MarkKind } | null>(null);
  const [label, setLabel] = useState('');
  const [obtained, setObtained] = useState('');
  const [maximum, setMaximum] = useState('10');
  const [markErrors, setMarkErrors] = useState<Record<string, string>>({});

  const setFieldError = (key: string, msg: string) => {
    setMarkErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const clearFieldError = (key: string) => {
    setMarkErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openAddMark = (part: MarkPart, kind: MarkKind) => {
    const isSingle = kind === 'mid' || kind === 'final';
    const count = data.marks.filter(
      (mark) => mark.course_id === course.id && mark.part === part && mark.kind === kind,
    ).length;
    if (isSingle && count >= 1) return;

    const title = `${kind[0].toUpperCase()}${kind.slice(1)}`;
    setAddingMark({ part, kind });
    setLabel(isSingle ? title : `${title} ${count + 1}`);
    setMaximum(kind === 'mid' ? '25' : kind === 'final' ? '50' : '10');
    setObtained('');
    clearFieldError(`${part}-${kind}-add`);
  };

  const submitAddMark = () => {
    if (!addingMark) return;
    const errKey = `${addingMark.part}-${addingMark.kind}-add`;
    const isSingle = addingMark.kind === 'mid' || addingMark.kind === 'final';
    const existingCount = data.marks.filter(
      (mark) =>
        mark.course_id === course.id &&
        mark.part === addingMark.part &&
        mark.kind === addingMark.kind,
    ).length;
    if (isSingle && existingCount >= 1) {
      setAddingMark(null);
      return;
    }

    const max = Number(maximum);
    if (!Number.isInteger(max) || max <= 0) {
      setFieldError(errKey, 'Maximum marks must be a positive whole number.');
      return;
    }
    const markObtained = obtained === '' ? null : Number(obtained);
    if (markObtained !== null && (!Number.isFinite(markObtained) || markObtained < 0)) {
      setFieldError(errKey, 'Obtained marks cannot be negative.');
      return;
    }
    if (markObtained !== null && markObtained > max) {
      setFieldError(errKey, `Obtained marks cannot exceed maximum marks (${max}).`);
      return;
    }
    clearFieldError(errKey);
    addMark(
      course.id,
      addingMark.part,
      addingMark.kind,
      label.trim() || null,
      max,
      markObtained,
    );
    setAddingMark(null);
  };

  const renderPart = (part: MarkPart) => {
    const partResult = part === 'theory' ? result.theoryResult : result.labResult;
    if (!partResult) return null;
    const weights = course.scheme[part];
    if (!weights) return null;

    return (
      <section className="min-w-0 overflow-hidden rounded-lg border border-gray-200 p-2.5 sm:p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold capitalize">{part}</h4>
          <span className="text-sm font-medium">
            {partResult.percent === null ? '—' : `${round2(partResult.percent).toFixed(2)}%`}
          </span>
        </div>

        {markKinds.map((kind) => {
          const items = data.marks.filter(
            (mark) => mark.course_id === course.id && mark.part === part && mark.kind === kind,
          );
          const isSingle = kind === 'mid' || kind === 'final';
          const canAdd = !isSingle || items.length === 0;
          const addErrKey = `${part}-${kind}-add`;

          return (
            <div key={kind} className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium capitalize truncate">
                  {kind} ({weights[kind]}%)
                </span>
                {canAdd && (
                  <button
                    type="button"
                    className="shrink-0 text-indigo-600"
                    onClick={() => openAddMark(part, kind)}
                  >
                    + Add
                  </button>
                )}
              </div>

              {addingMark?.part === part && addingMark.kind === kind && (
                <div className="rounded border border-indigo-200 bg-indigo-50 p-2">
                  <div className="grid grid-cols-[1fr_4.25rem_4.25rem] gap-1.5 sm:grid-cols-[1fr_5rem_5rem] sm:gap-2">
                    <input
                      type="text"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Label"
                      className="w-full min-w-0 border rounded px-2 py-1 text-xs sm:text-sm bg-white"
                    />
                    <input
                      type="number"
                      min={0}
                      max={Number(maximum) || undefined}
                      step={0.25}
                      value={obtained}
                      onChange={(event) => {
                        clearFieldError(addErrKey);
                        setObtained(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          submitAddMark();
                        }
                      }}
                      placeholder="Obtained"
                      className="w-full min-w-0 border rounded px-1.5 py-1 text-center text-xs sm:text-sm bg-white"
                      autoFocus
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={maximum}
                      onChange={(event) => {
                        clearFieldError(addErrKey);
                        setMaximum(event.target.value);
                      }}
                      placeholder="Max"
                      className="w-full min-w-0 border rounded px-1.5 py-1 text-center text-xs sm:text-sm bg-white"
                    />
                  </div>
                  {markErrors[addErrKey] && (
                    <p className="mt-1.5 text-xs text-red-600" role="alert">
                      {markErrors[addErrKey]}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                      onClick={submitAddMark}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="text-sm text-gray-500"
                      onClick={() => {
                        clearFieldError(addErrKey);
                        setAddingMark(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-xs text-gray-400">No {kind}s added yet.</p>
              ) : (
                items.map((mark) => (
                  <div key={mark.id} className="space-y-1">
                    <div className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2 text-sm">
                      <input
                        type="text"
                        size={1}
                        value={mark.label ?? ''}
                        onChange={(event) => updateMark(mark.id, { label: event.target.value || null })}
                        placeholder={kind}
                        className="flex-1 min-w-0 max-w-44 border rounded px-2 py-1 text-xs sm:text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        max={mark.max}
                        step={0.25}
                        value={mark.obtained ?? ''}
                        onChange={(event) => {
                          const value = event.target.value === '' ? null : Number(event.target.value);
                          if (value === null) {
                            clearFieldError(mark.id);
                            updateMark(mark.id, { obtained: null });
                            return;
                          }
                          if (!Number.isFinite(value) || value < 0) {
                            setFieldError(mark.id, 'Obtained marks cannot be negative.');
                            return;
                          }
                          if (value > mark.max) {
                            setFieldError(mark.id, `Obtained marks cannot exceed maximum marks (${mark.max}).`);
                            return;
                          }
                          clearFieldError(mark.id);
                          updateMark(mark.id, { obtained: value });
                        }}
                        placeholder="—"
                        className="w-14 sm:w-16 shrink-0 border rounded px-1.5 py-1 text-center text-xs sm:text-sm"
                      />
                      <span className="shrink-0 text-gray-400">/</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={mark.max}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isInteger(value) || value <= 0) {
                            setFieldError(mark.id, 'Maximum marks must be a positive whole number.');
                            return;
                          }
                          clearFieldError(mark.id);
                          const clampedObtained =
                            mark.obtained !== null && mark.obtained > value ? value : mark.obtained;
                          updateMark(mark.id, { max: value, obtained: clampedObtained });
                        }}
                        className="w-14 sm:w-16 shrink-0 border rounded px-1.5 py-1 text-center text-xs sm:text-sm"
                      />
                      <button
                        type="button"
                        aria-label="Delete mark"
                        title="Delete mark"
                        className="shrink-0 px-1.5 text-sm text-red-500 hover:text-red-700 cursor-pointer"
                        onClick={() => {
                          clearFieldError(mark.id);
                          deleteMark(mark.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {markErrors[mark.id] && (
                      <p className="text-xs text-red-600" role="alert">
                        {markErrors[mark.id]}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-base sm:text-lg break-words">{course.name}</h3>
          <p className="text-xs text-gray-400">
            {course.credits} credits{course.has_lab && ` (${course.theory_credits}T + ${course.lab_credits}L)`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl sm:text-2xl font-bold">
            {result.coursePercent === null ? '—' : `${round2(result.coursePercent).toFixed(2)}%`}
          </p>
          <p className="text-xs sm:text-sm font-medium text-indigo-600">
            {result.letter ?? 'No grade'}{result.gradePoint === null ? '' : ` · ${result.gradePoint.toFixed(2)}`}
          </p>
          {result.provisional && <span className="text-xs text-amber-600">Provisional</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="text-sm text-indigo-600" onClick={editing ? onStopEdit : onStartEdit}>
          {editing ? 'Close course settings' : 'Edit course'}
        </button>
        <button
          type="button"
          className="text-sm text-red-500 hover:underline cursor-pointer"
          onClick={onRequestDeleteCourse}
        >
          Delete course
        </button>
      </div>

      {editing && (
        <CourseForm
          initial={{
            name: course.name,
            credits: course.credits,
            hasLab: course.has_lab,
            theoryCredits: course.theory_credits,
            labCredits: course.lab_credits,
            scheme: course.scheme,
          }}
          onSubmit={(name, credits, hasLab, theoryCredits, labCredits, scheme) => {
            updateCourse(course.id, {
              name,
              credits,
              has_lab: hasLab,
              theory_credits: theoryCredits,
              lab_credits: labCredits,
              scheme,
            });
            onStopEdit();
          }}
          onCancel={onStopEdit}
        />
      )}

      <div className={`grid min-w-0 gap-3 ${course.has_lab ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {renderPart('theory')}
        {course.has_lab && renderPart('lab')}
      </div>
    </article>
  );
}