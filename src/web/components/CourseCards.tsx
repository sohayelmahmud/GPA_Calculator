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
  const [maximum, setMaximum] = useState('100');

  const openAddMark = (part: MarkPart, kind: MarkKind) => {
    const count = data.marks.filter(
      (mark) => mark.course_id === course.id && mark.part === part && mark.kind === kind,
    ).length;
    setAddingMark({ part, kind });
    setLabel(`${kind[0].toUpperCase()}${kind.slice(1)} ${count + 1}`);
    setMaximum(kind === 'mid' || kind === 'final' ? '100' : '10');
    setObtained('');
  };

  const submitAddMark = () => {
    if (!addingMark) return;
    const max = Number(maximum);
    if (!Number.isInteger(max) || max <= 0) {
      window.alert('Maximum marks must be a positive whole number.');
      return;
    }
    const markObtained = obtained === '' ? null : Number(obtained);
    if (
      markObtained !== null &&
      (!Number.isFinite(markObtained) ||
        markObtained < 0 ||
        (markObtained * 4) % 1 !== 0)
    ) {
      window.alert('Obtained marks must use 0.25 increments.');
      return;
    }
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
      <section className="rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold capitalize">{part}</h4>
          <span className="text-sm font-medium">
            {partResult.percent === null ? '—' : `${round2(partResult.percent).toFixed(2)}%`}
          </span>
        </div>

        {markKinds.map((kind) => {
          const items = data.marks.filter(
            (mark) => mark.course_id === course.id && mark.part === part && mark.kind === kind,
          );
          return (
            <div key={kind} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{kind} ({weights[kind]}%)</span>
                <button
                  type="button"
                  className="text-indigo-600"
                  onClick={() => openAddMark(part, kind)}
                >
                  + Add
                </button>
              </div>

              {addingMark?.part === part && addingMark.kind === kind && (
                <div className="rounded border border-indigo-200 bg-indigo-50 p-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Label"
                      className="border rounded px-2 py-1 text-sm"
                      autoFocus
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={obtained}
                      onChange={(event) => setObtained(event.target.value)}
                      placeholder="Obtained"
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={maximum}
                      onChange={(event) => setMaximum(event.target.value)}
                      placeholder="Maximum"
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded bg-indigo-600 px-3 py-1 text-sm text-white" onClick={submitAddMark}>
                      Add
                    </button>
                    <button type="button" className="text-sm text-gray-500" onClick={() => setAddingMark(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-xs text-gray-400">No {kind}s added yet.</p>
              ) : (
                items.map((mark) => (
                  <div key={mark.id} className="flex min-w-0 items-center gap-1.5 text-sm">
                    <input
                      type="text"
                      value={mark.label ?? ''}
                      onChange={(event) => updateMark(mark.id, { label: event.target.value || null })}
                      placeholder={kind}
                      className="min-w-0 flex-1 border rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={mark.obtained ?? ''}
                      onChange={(event) => {
                        const value = event.target.value === '' ? null : Number(event.target.value);
                        if (
                          value !== null &&
                          (!Number.isFinite(value) || value < 0 || (value * 4) % 1 !== 0)
                        ) return;
                        updateMark(mark.id, { obtained: value });
                      }}
                      placeholder="—"
                      className="w-12 min-w-12 flex-none border rounded px-1 py-1"
                    />
                    <span>/</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={mark.max}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isInteger(value) && value > 0) {
                          updateMark(mark.id, { max: value });
                        }
                      }}
                      className="w-12 min-w-12 flex-none border rounded px-1 py-1"
                    />
                    <button type="button" className="text-red-500" onClick={() => deleteMark(mark.id)}>
                      Delete
                    </button>
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
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">{course.name}</h3>
          <p className="text-xs text-gray-400">
            {course.credits} credits{course.has_lab && ` (${course.theory_credits}T + ${course.lab_credits}L)`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{result.coursePercent === null ? '—' : `${round2(result.coursePercent).toFixed(2)}%`}</p>
          <p className="text-sm font-medium text-indigo-600">
            {result.letter ?? 'No grade'}{result.gradePoint === null ? '' : ` · ${result.gradePoint.toFixed(2)}`}
          </p>
          {result.provisional && <span className="text-xs text-amber-600">Provisional</span>}
        </div>
      </div>

      <div className="flex gap-3">
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

      <div className={`grid min-w-0 gap-3 ${course.has_lab ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {renderPart('theory')}
        {course.has_lab && renderPart('lab')}
      </div>
    </article>
  );
}

