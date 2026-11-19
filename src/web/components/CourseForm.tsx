import { useState } from 'react';
import type { GradingScheme } from '@shared/types';
import { SCHEME_PRESETS } from '@shared/types';

interface Props {
  onSubmit: (
    name: string,
    credits: number,
    hasLab: boolean,
    theoryCredits: number | null,
    labCredits: number | null,
    scheme: GradingScheme,
  ) => void;
  onCancel: () => void;
  initial?: {
    name: string;
    credits: number;
    hasLab: boolean;
    theoryCredits: number | null;
    labCredits: number | null;
    scheme: GradingScheme;
  };
}

export default function CourseForm({ onSubmit, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [credits, setCredits] = useState(initial?.credits ?? 3);
  const [hasLab, setHasLab] = useState(initial?.hasLab ?? false);
  const [theoryCredits, setTheoryCredits] = useState<number>(initial?.theoryCredits ?? 3);
  const [labCredits, setLabCredits] = useState<number>(initial?.labCredits ?? 1);
  const [theoryScheme, setTheoryScheme] = useState(
    initial?.scheme.theory ?? { ...SCHEME_PRESETS.standardTheory },
  );
  const [labScheme, setLabScheme] = useState(
    initial?.scheme.lab ?? { ...SCHEME_PRESETS.standardLab },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!Number.isInteger(credits) || credits < 1) return;
    if (hasLab) {
      if (!Number.isInteger(theoryCredits) || !Number.isInteger(labCredits)) return;
      if (theoryCredits + labCredits !== credits) return;
    }
    const scheme: GradingScheme = {
      theory: theoryScheme,
      ...(hasLab ? { lab: labScheme } : {}),
    };
    onSubmit(name.trim(), credits, hasLab, hasLab ? theoryCredits : null, hasLab ? labCredits : null, scheme);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">{initial ? 'Edit Course' : 'Add Course'}</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Data Structures"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Credits</label>
          <input
            type="number"
            min={1}
            step={1}
            value={credits}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setCredits(v);
              if (hasLab) setTheoryCredits(Math.max(0, v - labCredits));
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={hasLab}
              onChange={(e) => {
                setHasLab(e.target.checked);
                if (e.target.checked) {
                  setLabCredits(1);
                  setTheoryCredits(credits - 1);
                }
              }}
              className="rounded"
            />
            Has Lab
          </label>
        </div>
      </div>

      {hasLab && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Theory Credits</label>
            <input
              type="number"
              min={0}
              step={1}
              value={theoryCredits}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setTheoryCredits(v);
                setLabCredits(credits - v);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lab Credits</label>
            <input
              type="number"
              min={0}
              step={1}
              value={labCredits}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setLabCredits(v);
                setTheoryCredits(credits - v);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <SchemeEditor
        label="Theory Weights"
        scheme={theoryScheme}
        onChange={setTheoryScheme}
        presets={[
          { label: 'Standard', value: { ...SCHEME_PRESETS.standardTheory } },
          { label: 'No Assign/Quiz', value: { ...SCHEME_PRESETS.noAssignmentQuiz } },
        ]}
      />

      {hasLab && (
        <SchemeEditor
          label="Lab Weights"
          scheme={labScheme}
          onChange={setLabScheme}
          presets={[{ label: 'Standard Lab', value: { ...SCHEME_PRESETS.standardLab } }]}
        />
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          {initial ? 'Save Changes' : 'Add Course'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SchemeEditor({
  label,
  scheme,
  onChange,
  presets,
}: {
  label: string;
  scheme: { assignment: number; quiz: number; mid: number; final: number };
  onChange: (s: { assignment: number; quiz: number; mid: number; final: number }) => void;
  presets: { label: string; value: typeof scheme }[];
}) {
  const total = scheme.assignment + scheme.quiz + scheme.mid + scheme.final;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ ...p.value })}
              className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 rounded transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(['assignment', 'quiz', 'mid', 'final'] as const).map((k) => (
          <div key={k}>
            <label className="block text-xs text-gray-500 capitalize mb-0.5">{k}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={scheme[k]}
              onChange={(e) => onChange({ ...scheme, [k]: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>
      {total !== 100 && (
        <p className="text-xs text-red-500 mt-1">Weights sum to {total}, should be 100</p>
      )}
    </div>
  );
}
