import { useState, useMemo, useRef, useEffect } from 'react';
import type { GradingScheme } from '@shared/types';
import { SCHEME_PRESETS } from '@shared/types';
import { CUI_BCS_COURSES, type PresetCourse } from '@shared/cuiCourses';

// In-memory cache across form opens/closes during the session
let cachedCourses: PresetCourse[] | null = null;
let fetchPromise: Promise<PresetCourse[]> | null = null;

function loadPresetCourses(): Promise<PresetCourse[]> {
  if (cachedCourses) return Promise.resolve(cachedCourses);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/preset-courses')
    .then((res) => (res.ok ? (res.json() as Promise<{ courses?: PresetCourse[] }>) : null))
    .then((data) => {
      if (data?.courses && data.courses.length > 0) {
        cachedCourses = data.courses;
        return cachedCourses;
      }
      return CUI_BCS_COURSES;
    })
    .catch(() => CUI_BCS_COURSES)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

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

  const [presetCourses, setPresetCourses] = useState<PresetCourse[]>(
    () => cachedCourses ?? CUI_BCS_COURSES,
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let active = true;
    loadPresetCourses().then((list) => {
      if (active) setPresetCourses(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = name.trim().toLowerCase();
    if (!query) return [];

    const matches = presetCourses
      .map((c) => {
        const acronym = c.name
          .split(/\s+/)
          .map((w) => w[0]?.toLowerCase() ?? '')
          .join('');
        const lowerName = c.name.toLowerCase();
        const lowerCode = c.code.toLowerCase();
        const aliases = c.aliases?.map((a) => a.toLowerCase()) ?? [];

        let score = 0;
        if (acronym === query || aliases.includes(query) || lowerCode === query) {
          score = 3;
        } else if (
          acronym.startsWith(query) ||
          aliases.some((a) => a.startsWith(query)) ||
          lowerName.startsWith(query) ||
          lowerCode.startsWith(query)
        ) {
          score = 2;
        } else if (lowerName.includes(query) || lowerCode.includes(query)) {
          score = 1;
        }

        return { course: c, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return matches.map((m) => m.course).slice(0, 15);
  }, [name, presetCourses]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredCourses]);

  useEffect(() => {
    if (!showSuggestions || !listRef.current) return;
    const activeItem = listRef.current.children[activeIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, showSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPreset = (course: PresetCourse) => {
    setName(course.name);
    setCredits(course.credits);
    setHasLab(course.hasLab);
    if (course.hasLab) {
      setTheoryCredits(course.theoryCredits);
      setLabCredits(course.labCredits);
    } else {
      setTheoryCredits(course.credits);
      setLabCredits(1);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredCourses.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredCourses.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredCourses.length) % filteredCourses.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCourses[activeIndex];
      if (selected) handleSelectPreset(selected);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!Number.isInteger(credits) || credits < 0) return;
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

      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by course name or code (e.g. Data Structures, CSC211)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          autoComplete="off"
          autoFocus
        />

        {showSuggestions && filteredCourses.length > 0 && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-gray-100"
          >
            {filteredCourses.map((course, idx) => {
              const isActive = idx === activeIndex;
              return (
                <li key={course.code} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelectPreset(course)}
                    className={`w-full text-left px-3 py-2 transition flex items-center justify-between gap-2 ${isActive ? 'bg-indigo-50' : 'hover:bg-indigo-50'
                      }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-indigo-600 mr-2">{course.code}</span>
                      <span className="text-sm text-gray-800">{course.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 bg-gray-100 px-2 py-0.5 rounded">
                      {course.hasLab
                        ? `${course.credits} (${course.theoryCredits}+${course.labCredits})`
                        : `${course.credits} Cr`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Credits</label>
          <input
            type="number"
            min={0}
            step={1}
            value={credits}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              const v = Number.isNaN(raw) ? 0 : Math.max(0, raw);
              setCredits(v);
              if (hasLab) {
                const nextLab = v === 0 ? 0 : Math.min(labCredits, v);
                setLabCredits(nextLab);
                setTheoryCredits(Math.max(0, v - nextLab));
              }
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
                  const defaultLab = credits > 0 ? 1 : 0;
                  setLabCredits(defaultLab);
                  setTheoryCredits(Math.max(0, credits - defaultLab));
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
              max={credits}
              step={1}
              value={theoryCredits}
              onChange={(e) => {
                const raw = parseInt(e.target.value, 10);
                const v = Number.isNaN(raw) ? 0 : Math.min(Math.max(0, raw), credits);
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
              max={credits}
              step={1}
              value={labCredits}
              onChange={(e) => {
                const raw = parseInt(e.target.value, 10);
                const v = Number.isNaN(raw) ? 0 : Math.min(Math.max(0, raw), credits);
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
          { label: 'Project Based', value: { ...SCHEME_PRESETS.noAssignmentQuiz } },
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