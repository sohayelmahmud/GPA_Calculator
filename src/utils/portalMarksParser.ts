import type { MarkKind, MarkPart } from '@shared/types';

export interface ParsedPortalMark {
  part: MarkPart;
  kind: MarkKind;
  label: string;
  obtained: number;
  max: number;
}

export interface PortalParseResult {
  marks: ParsedPortalMark[];
  errors: string[];
  warnings: string[];
}

const SECTION_MAP: Record<string, { part: MarkPart; kind: MarkKind } | undefined> = {
  quizzes: { part: 'theory', kind: 'quiz' },
  assignments: { part: 'theory', kind: 'assignment' },
  'lab assignments': { part: 'lab', kind: 'assignment' },
  'midterm marks': { part: 'theory', kind: 'mid' },
  'lab midterm marks': { part: 'lab', kind: 'mid' },
  'final marks': { part: 'theory', kind: 'final' },
};

function normalizeSectionName(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function splitDesktopRow(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => cell.trim()).filter((cell) => cell !== '');
  }
  return line.split(/\s{2,}/).map((cell) => cell.trim()).filter((cell) => cell !== '');
}

function addMark(
  marks: ParsedPortalMark[],
  errors: string[],
  section: { part: MarkPart; kind: MarkKind },
  sectionName: string,
  label: string,
  obtainedText: string,
  maxText: string,
  hasLab: boolean,
  warnings: string[],
): void {
  const cleanedLabel = label.trim();
  const obtained = Number(obtainedText.trim());
  const max = Number(maxText.trim());

  if (!cleanedLabel) {
    warnings.push(`Skipped a row in ${sectionName} because it has no title.`);
    return;
  }
  if (!Number.isFinite(obtained) || obtained < 0) {
    errors.push(`Invalid obtained marks for "${cleanedLabel}" in ${sectionName}.`);
    return;
  }
  if (!Number.isFinite(max) || max <= 0) {
    errors.push(`Invalid total marks for "${cleanedLabel}" in ${sectionName}.`);
    return;
  }
  if (obtained > max) {
    errors.push(`Obtained marks exceed total marks for "${cleanedLabel}" in ${sectionName}.`);
    return;
  }
  if (section.part === 'lab' && !hasLab) {
    warnings.push(`Skipped lab mark "${cleanedLabel}" because this course has no lab.`);
    return;
  }

  marks.push({
    part: section.part,
    kind: section.kind,
    label: cleanedLabel,
    obtained,
    max,
  });
}

export function parsePortalMarks(text: string, hasLab: boolean): PortalParseResult {
  const marks: ParsedPortalMark[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let section: { part: MarkPart; kind: MarkKind } | null = null;
  let sectionName = '';

  let mobileTitle: string | null = null;
  let mobileObtained: string | null = null;
  let mobileMax: string | null = null;
  let waitingForMobileDate = false;

  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const normalized = normalizeSectionName(line);
    if (SECTION_MAP[normalized]) {
      section = SECTION_MAP[normalized]!;
      sectionName = normalized;
      mobileTitle = null;
      mobileObtained = null;
      mobileMax = null;
      waitingForMobileDate = false;
      continue;
    }

    const normalizedCells = splitDesktopRow(line).map(normalizeSectionName);
    if (
      normalizedCells.length >= 3 &&
      normalizedCells[0] === 'title' &&
      normalizedCells.includes('obtained marks') &&
      normalizedCells.includes('total marks')
    ) {
      continue;
    }

    if (/^no .*marks? are available/i.test(line) || /^no .*available/i.test(line)) {
      mobileTitle = null;
      mobileObtained = null;
      mobileMax = null;
      waitingForMobileDate = false;
      continue;
    }

    if (!section) continue;

    const cells = splitDesktopRow(line);
    const isDesktopRow =
      cells.length >= 3 &&
      cells[0].toLowerCase() !== 'title';

    if (isDesktopRow) {
      mobileTitle = null;
      mobileObtained = null;
      mobileMax = null;
      waitingForMobileDate = false;
      addMark(
        marks,
        errors,
        section,
        sectionName,
        cells[0],
        cells[1],
        cells[2],
        hasLab,
        warnings,
      );
      continue;
    }

    if (waitingForMobileDate) {
      waitingForMobileDate = false;
      mobileTitle = null;
      mobileObtained = null;
      mobileMax = null;
      continue;
    }

    if (mobileTitle === null) {
      mobileTitle = line;
      continue;
    }
    if (mobileObtained === null) {
      if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(line)) {
        mobileObtained = line;
        continue;
      }
      warnings.push(`Expected obtained marks after "${mobileTitle}" in ${sectionName}.`);
      mobileTitle = null;
      continue;
    }
    if (mobileMax === null) {
      if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(line)) {
        mobileMax = line;
        continue;
      }
      warnings.push(`Expected total marks after "${mobileTitle}" in ${sectionName}.`);
      mobileTitle = null;
      mobileObtained = null;
      continue;
    }

    addMark(
      marks,
      errors,
      section,
      sectionName,
      mobileTitle,
      mobileObtained,
      mobileMax,
      hasLab,
      warnings,
    );
    mobileTitle = null;
    mobileObtained = null;
    mobileMax = null;
    continue;
  }

  if (mobileTitle !== null) {
    warnings.push(`Incomplete mobile-copied row "${mobileTitle}" in ${sectionName}.`);
  }

  return { marks, errors, warnings };
}

export default parsePortalMarks;
