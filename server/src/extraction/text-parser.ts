import type { RawItem } from './normalizer';
import { toAsciiDigits } from './normalizer';

/**
 * Turns OCR text into measurement items. Pure function, no I/O.
 * Understands lines such as:
 *   "Hall 12.6 x 10.3 ft"        -> label Hall, length 12.6, breadth 10.3
 *   "1) Bedroom 14' 6\" x 9' 8\"" -> feet and inches written out
 *   "Passage 20.4"               -> label Passage, length 20.4
 *   "Doors 3 nos"                -> label Doors, count 3
 * Numbers stay TEXT, exactly as read. How "10.8" is interpreted is decided later by the calculation mode.
 */

const NUM = String.raw`\d+(?:\.\d+)?`;
// A plain number, or feet-inches written out: 14' 6" / 14'6 / 14 ft 6 in.
// A trailing unit alone ("20.4 ft") is NOT part of the size.
const DIM = String.raw`${NUM}(?:\s*'\s*(?:${NUM})?\s*(?:"|in\.?)?|\s*(?:ft\.?|feet)\s+${NUM}\s*(?:"|in\.?)?)?`;
const SEP = String.raw`\s*(?:x|×|\*|by)\s*`;

const PAIR = new RegExp(String.raw`^(?<label>.*?)\s*(?<a>${DIM})${SEP}(?<b>${DIM})(?<rest>.*)$`, 'i');
const COUNT = new RegExp(String.raw`^(?<label>.*?)\s*(?<n>\d{1,6})\s*(?:nos?\.?|pcs?\.?|pieces?|numbers?|गोटा|वटा)(?![\p{L}])`, 'iu');
const DIM_GLOBAL = new RegExp(DIM, 'gi');

const SKIP_LABEL = /^(total|sub\s*total|grand|sum|amount|rate|rs\.?|price|page|date|invoice|bill|कुल|जम्मा|रकम|दर)\b/i;
const MAX_ITEMS = 200;

/** In tokens that contain digits, fix letters OCR often confuses with digits (O->0, l/I/|->1). */
function fixDigitLookalikes(line: string): string {
  return line
    .split(' ')
    .map((tok) => (/\d/.test(tok) && /^[0-9OoIl|.,'"xX*×-]+$/.test(tok) ? tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : tok))
    .join(' ');
}

function cleanLine(raw: string): string {
  let s = toAsciiDigits(raw)
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/[|_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = fixDigitLookalikes(s);
  s = s.replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2'); // "10 . 6" and "10,6" -> "10.6"
  s = s.replace(/^\(?\d{1,2}\s*[.)\]:]\s+(?=\D)/, ''); // list numbering such as "1. " or "2) "
  return s.trim();
}

function cleanLabel(label: string): string {
  return label.replace(/[:=\-–—]+\s*$/, '').replace(/^[\s:=\-–—.]+/, '').replace(/\s+/g, ' ').trim();
}

function unitFrom(rest: string): string | null {
  if (/\b(m|mtr|mtrs|meters?|metres?)\b/i.test(rest)) return 'm';
  if (/\b(ft|feet|foot)\b|'/i.test(rest)) return 'ft';
  return null;
}

function parseLine(line: string): RawItem | null {
  const pair = PAIR.exec(line);
  if (pair?.groups) {
    const label = cleanLabel(pair.groups.label);
    if (SKIP_LABEL.test(label)) return null;
    return { label, length: pair.groups.a.trim(), breadth: pair.groups.b.trim(), count: null, unit: unitFrom(pair.groups.rest) };
  }

  const count = COUNT.exec(line);
  if (count?.groups) {
    const label = cleanLabel(count.groups.label);
    if (SKIP_LABEL.test(label) || !/\p{L}{2,}/u.test(label)) return null;
    return { label, length: null, breadth: null, count: count.groups.n, unit: null };
  }

  // A label with exactly one size, e.g. "Passage 20.4 ft".
  const dims = line.match(DIM_GLOBAL) ?? [];
  if (dims.length === 1) {
    const at = line.indexOf(dims[0]);
    const label = cleanLabel(line.slice(0, at));
    const value = dims[0].trim();
    const looksLikeSize = value.includes('.') || value.replace(/\D/g, '').length >= 2 || /['"]|ft|feet|in/i.test(value);
    if (/\p{L}{2,}/u.test(label) && !SKIP_LABEL.test(label) && looksLikeSize) {
      return { label, length: value, breadth: null, count: null, unit: unitFrom(line.slice(at + dims[0].length)) };
    }
  }
  return null;
}

/** Reads one OCR line. Returns null when the line is not a measurement. */
export function parseMeasurementLine(raw: string): RawItem | null {
  const line = cleanLine(raw);
  return line ? parseLine(line) : null;
}

export function parseMeasurementText(text: string): RawItem[] {
  const items: RawItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const item = parseLine(line);
    if (item) items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}
