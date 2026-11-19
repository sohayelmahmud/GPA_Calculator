import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PreviousSemester } from '@shared/types';

export function PreviousSemesterCard({
  previousSemesters,
  updatePreviousSemesters,
}: {
  previousSemesters: PreviousSemester[];
  updatePreviousSemesters: (previousSemesters: PreviousSemester[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('');
  const [sgpa, setSgpa] = useState('');

  const addPreviousSemester = () => {
    const creditValue = Number(credits);
    const sgpaValue = Number(sgpa);
    if (
      !Number.isInteger(creditValue) ||
      creditValue <= 0 ||
      !Number.isFinite(sgpaValue) ||
      sgpaValue < 0
    ) return;

    updatePreviousSemesters([
      ...previousSemesters,
      {
        id: uuidv4(),
        name: name.trim(),
        credits: creditValue,
        sgpa: sgpaValue,
      },
    ]);
    setName('');
    setCredits('');
    setSgpa('');
    setShowForm(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">Previous semesters</p>
      {previousSemesters.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {previousSemesters.map((semester) => (
            <div key={semester.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="truncate text-gray-700">
                {semester.name || 'Previous'} · {semester.credits} cr
              </span>
              <div className="flex flex-none items-center gap-2">
                <span className="font-semibold">{semester.sgpa.toFixed(2)}</span>
                <button
                  type="button"
                  className="text-red-500"
                  onClick={() =>
                    updatePreviousSemesters(
                      previousSemesters.filter((item) => item.id !== semester.id),
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Semester name (optional)"
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              placeholder="Credits"
              className="min-w-0 rounded border px-2 py-1 text-sm"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={sgpa}
              onChange={(event) => setSgpa(event.target.value)}
              placeholder="SGPA"
              className="min-w-0 rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="text-sm text-indigo-600" onClick={addPreviousSemester}>
              Add
            </button>
            <button type="button" className="text-sm text-gray-500" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="mt-3 text-sm text-indigo-600" onClick={() => setShowForm(true)}>
          + Add previous SGPA
        </button>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  provisional,
  subtitle,
}: {
  label: string;
  value: string;
  provisional?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      {provisional && (
        <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full">
          Provisional
        </span>
      )}
    </div>
  );
}
