import type { RawItem } from './normalizer';
import { toAsciiDigits } from './normalizer';

/**
 * Turns OCR text into measurement lines. Pure function, no I/O.
 *
 * A line can be
 *   "13 x 11.9"            length x breadth
 *   "119.6 + 16.5"         things added together
 *   "35.6"                 a plain number (an area already worked out)
 *   "13 x 11.9 = 154.7"    with the writer's own result after "="
 *   "Hall 12.6 x 10.3 ft"  with a room name and a unit
 *   "Doors 3 nos"          a count
 * Numbers stay TEXT, exactly as read. How "10.8" is understood (decimal or feet.inches) is decided later
 * by the calculation mode. Anything that does not fit is dropped, never guessed.
 */

const NUM = String.raw`\d+(?:\.\d+)?`;
const FEET_IN = String.raw`${NUM}\s*'\s*(?:${NUM})?\s*(?:"|in\.?)?`; // 14' 6"
const FACTOR = String.raw`(?:${FEET_IN}|${NUM})`;
const PRODUCT = String.raw`${FACTOR}(?:\s*x\s*${FACTOR})*`;
const BODY = new RegExp(String.raw`^${PRODUCT}(?:\s*\+\s*${PRODUCT})*$`);
const COUNT = new RegExp(String.raw`^(?<n>\d{1,6})\s*(?:nos?\.?|pcs?\.?|pieces?|numbers?|गोटा|वटा)(?![\p{L}])`, 'iu');

// Lines that are totals or paperwork, not measurements ("Total", and the usual misspelling "Tobal").
const SKIP_LABEL = /^(t[o0][a-z]{2}l|sub\s*total|grand|sum|amount|rate|rs\.?|price|page|date|invoice|bill|कुल|जम्मा|रकम|दर)\b/i;
const MAX_ITEMS = 200;
const MAX_VALUE = 1_000_000; // a plain number above this is a phone number or a page code, not an area

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
    .replace(/[·•∙⋅‧]/g, '.') // handwriting often uses a raised dot as the decimal point
    .replace(/[×*✕✖]/g, 'x')
    .replace(/[|_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = fixDigitLookalikes(s);
  s = s.replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2'); // "10 . 6" and "10,6" -> "10.6"
  s = s.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1 x '); // "9x18" and "36X14" -> "9 x 18"
  s = s.replace(/^\(?\d{1,2}\s*[.)\]:]\s+(?=[A-Za-z\p{L}])/u, ''); // list numbering such as "1) " before a name
  return s.trim();
}

const cleanLabel = (label: string): string => label.replace(/[:=\-–—]+\s*$/, '').replace(/^[\s:=\-–—.]+/, '').replace(/\s+/g, ' ').trim();

function unitFrom(text: string): string | null {
  if (/\b(m|mtr|mtrs|meters?|metres?)\b/i.test(text)) return 'm';
  if (/\b(ft|feet|foot|sq\.?\s*ft|sqft)\b|'/i.test(text)) return 'ft';
  return null;
}

/** Reads one OCR line. Returns null when the line is not a measurement. */
export function parseMeasurementLine(raw: string): RawItem | null {
  const line = cleanLine(raw);
  if (!line) return null;

  // "13 x 11.9 = 154.7": keep the writer's own result to double-check against.
  const [left, ...after] = line.split('=');
  const writtenMatch = after.length ? /^\s*(\d+(?:\.\d+)?)/.exec(after.join('=')) : null;
  const written = writtenMatch ? writtenMatch[1] : null;

  const m = /^(?<label>[^\d]*?)\s*(?<body>\d.*)$/.exec(left.trim());
  if (!m?.groups) return null;
  const label = cleanLabel(m.groups.label);
  if (SKIP_LABEL.test(label)) return null;
  // A name ending in x or + means the start of the line was damaged ("Jey x 1.5"): drop it, do not guess.
  if (/[x+]$/i.test(label)) return null;

  const unit = unitFrom(m.groups.body);
  const body = m.groups.body
    .replace(/\s*(?:sq\.?\s*ft\.?|sqft|ft\.?|feet|foot|mtrs?|meters?|metres?|m)\s*$/i, '')
    .replace(/[\s.,;:|-]+$/, '')
    .replace(/\s*x\s*/gi, ' x ')
    .replace(/\s*\+\s*/g, ' + ')
    .trim()
    .toLowerCase();

  const letters = (label.match(/\p{L}/gu) ?? []).length;

  const count = COUNT.exec(body);
  if (count?.groups) {
    if (letters < 3) return null;
    return { label, expr: null, written: null, length: null, breadth: null, count: count.groups.n, unit: null };
  }

  if (!BODY.test(body)) return null;
  const hasOperator = /[x+]/.test(body);
  if (!hasOperator) {
    const value = Number(body);
    if (!Number.isFinite(value) || value <= 0 || value > MAX_VALUE) return null;
    if (letters > 0 && letters < 3) return null; // a two-letter scrap with a number is OCR noise
  }

  // Keep separate length / breadth too, for a plain "A x B" or "A".
  const factors = !body.includes('+') ? body.split(' x ') : [];
  return {
    label,
    expr: body,
    written,
    length: factors.length >= 1 && factors.length <= 2 ? factors[0] : null,
    breadth: factors.length === 2 ? factors[1] : null,
    count: null,
    unit,
  };
}

export function parseMeasurementText(text: string): RawItem[] {
  const items: RawItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const item = parseMeasurementLine(raw);
    if (item) items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}
