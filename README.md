# CGPA Calculator

A browser-based GPA tracker for recording semester courses and marks, then calculating course grades, SGPA, and CGPA from the entered results.

## What it does

- Create, rename, and delete semesters.
- Add courses with credit hours and optional theory/lab splits.
- Define grading weights for assignments, quizzes, midterms, and finals.
- Add, edit, and remove marks using different maximum scores.
- Calculate course percentages, grade points, SGPA, and overall CGPA.
- Track previous semester SGPA values when calculating CGPA.
- Edit the grade scale used to map percentages to letters and grade points.
- Export all saved data as `gpa-data.json` or clear it from the browser.

Calculations update immediately as marks change. Incomplete courses are marked provisional, and only entered components contribute to a partial percentage.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Data storage

The application currently stores all semesters, courses, marks, previous semester values, and grade-scale settings in `localStorage` under the key `cgpa-calculator-data`. Data is local to the browser and is not synchronized between devices or users. Use **Export data** in Settings to create a backup.

## Technology

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router

The calculation logic is shared in [`src/shared/grade.ts`](./src/shared/grade.ts), while browser persistence is implemented in [`src/web/lib/storage.ts`](./src/web/lib/storage.ts).
