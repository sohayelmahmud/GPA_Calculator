import { useState } from 'react';
import type { AppData, GradeScaleEntry } from '@shared/types';
import { exportData } from '@/lib/storage';

interface Props {
  data: AppData;
  updateGradeScale: (scale: Omit<GradeScaleEntry, 'id' | 'user_id'>[]) => void;
  resetData: () => void;
}

export default function Settings({ data, updateGradeScale, resetData }: Props) {
  const [scale, setScale] = useState(data.gradeScale);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold">Grade scale</h2>
        {scale.map((entry, index) => (
          <div className="grid grid-cols-3 gap-2" key={entry.id}>
            <input className="border rounded px-2 py-1" type="number" value={entry.min_percent} onChange={(e) => setScale((s) => s.map((item, i) => i === index ? { ...item, min_percent: Number(e.target.value) } : item))} />
            <input className="border rounded px-2 py-1" type="number" step="0.01" value={entry.grade_point} onChange={(e) => setScale((s) => s.map((item, i) => i === index ? { ...item, grade_point: Number(e.target.value) } : item))} />
            <input className="border rounded px-2 py-1" value={entry.letter} onChange={(e) => setScale((s) => s.map((item, i) => i === index ? { ...item, letter: e.target.value } : item))} />
          </div>
        ))}
        <button type="button" className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={() => updateGradeScale(scale.map(({ min_percent, grade_point, letter }) => ({ min_percent, grade_point, letter })))}>Save scale</button>
      </section>
      <div className="flex gap-3">
        <button type="button" className="text-indigo-600" onClick={() => { const blob = new Blob([exportData(data)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'gpa-data.json'; link.click(); URL.revokeObjectURL(url); }}>Export data</button>
        <button type="button" className="text-red-600" onClick={() => { if (confirm('Delete all saved data?')) resetData(); }}>Delete all data</button>
      </div>
    </div>
  );
}
