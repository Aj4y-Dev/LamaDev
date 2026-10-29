import { Injectable } from '@nestjs/common';
import { Unit } from '../common/types';

export interface RawItemInput {
  label?: string | number | null;
  length?: string | number | null;
  breadth?: string | number | null;
  count?: string | number | null;
  unit?: string | null;
}
export interface NormalizedDraftItem {
  categoryKey: string;
  label: string;
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
}

const NEPALI_ZERO = 0x0966;
const MAX_DIMENSION_CHARS = 32;

/**
 * Cleans what the model read. It never converts feet-inches to decimals, because the calculation mode
 * decides how "10.8" is read. Pure functions only.
 */
@Injectable()
export class NormalizerService {
  toAsciiDigits(input: string): string {
    let out = '';
    for (const ch of input) {
      const code = ch.codePointAt(0) ?? 0;
      out += code >= NEPALI_ZERO && code <= NEPALI_ZERO + 9 ? String(code - NEPALI_ZERO) : ch;
    }
    return out;
  }

  normalizeLabel(raw: unknown): string {
    return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  /** Returns the size text as written (ASCII digits, tidy quotes), or null when empty. */
  normalizeDimensionText(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    let s = this.toAsciiDigits(String(raw))
      .replace(/[′’‘]/g, "'")
      .replace(/[″”“]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.'); // 10,8 -> 10.8
    if (s === '') return null;
    return s.slice(0, MAX_DIMENSION_CHARS);
  }

  normalizeUnit(raw: unknown): Unit {
    const s = String(raw ?? '').toLowerCase().replace(/[.\s]/g, '');
    if (['m', 'meter', 'metre', 'meters', 'metres', 'mtr'].includes(s)) return 'm';
    return 'ft';
  }

  normalizeCount(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = parseInt(this.toAsciiDigits(String(raw)), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  normalizeExtractedItem(raw: RawItemInput, categoryKey: string): NormalizedDraftItem {
    return {
      categoryKey,
      label: this.normalizeLabel(raw.label),
      length: this.normalizeDimensionText(raw.length),
      breadth: this.normalizeDimensionText(raw.breadth),
      count: this.normalizeCount(raw.count),
      unit: this.normalizeUnit(raw.unit),
    };
  }
}
