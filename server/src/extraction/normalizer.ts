import { Unit } from '../lib/types';

export interface RawItem {
  label?: string | number | null;
  length?: string | number | null;
  breadth?: string | number | null;
  count?: string | number | null;
  unit?: string | null;
  /** The line as written, e.g. "13 x 11.9" or "119.6 + 16.5". */
  expr?: string | null;
  /** The result the writer put after "=". */
  written?: string | number | null;
  /** Lowest OCR confidence (0-100) among the numbers on this line. */
  confidence?: number;
  /** True when the numbers on this line should be double-checked by a person. */
  uncertain?: boolean;
}
export interface DraftItem {
  categoryKey: string;
  label: string;
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
  expr: string | null;
  written: string | null;
  uncertain: boolean;
}

const NEPALI_ZERO = 0x0966;
const MAX_DIMENSION_CHARS = 32;

export function toAsciiDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += code >= NEPALI_ZERO && code <= NEPALI_ZERO + 9 ? String(code - NEPALI_ZERO) : ch;
  }
  return out;
}

export function normalizeLabel(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * Cleans a size and keeps it as TEXT, exactly as written (ASCII digits, tidy quotes).
 * It never converts feet-inches to decimals: the calculation mode decides how "10.8" is read.
 */
export function normalizeDimensionText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = toAsciiDigits(String(raw))
    .replace(/[′’‘]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.'); // 10,8 -> 10.8
  if (s === '') return null;
  return s.slice(0, MAX_DIMENSION_CHARS);
}

export function normalizeUnit(raw: unknown): Unit {
  const s = String(raw ?? '').toLowerCase().replace(/[.\s]/g, '');
  return ['m', 'meter', 'metre', 'meters', 'metres', 'mtr'].includes(s) ? 'm' : 'ft';
}

/** A line such as "13 x 11.9" or "119.6 + 16.5": ASCII digits, a lowercase x, single spaces. */
export function normalizeExprText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = toAsciiDigits(String(raw))
    .replace(/[×*✕✖X]/g, 'x')
    .replace(/[′’‘]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return s === '' ? null : s.slice(0, 120);
}

export function normalizeCount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseInt(toAsciiDigits(String(raw)), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function normalizeExtractedItem(raw: RawItem, categoryKey: string): DraftItem {
  return {
    categoryKey,
    label: normalizeLabel(raw.label),
    length: normalizeDimensionText(raw.length),
    breadth: normalizeDimensionText(raw.breadth),
    count: normalizeCount(raw.count),
    unit: normalizeUnit(raw.unit),
    expr: normalizeExprText(raw.expr),
    written: normalizeDimensionText(raw.written),
    uncertain: raw.uncertain ?? false,
  };
}
