import { CalcMode, Unit } from '../common/types';
import { D, Dec } from '../common/utils/decimal';

export type DimensionResult = { ok: true; feet: Dec } | { ok: false; reason: 'MISSING' | 'INVALID' };

const METRE_TO_FEET = new D('3.28084');
const PLAIN = /^\d+(\.\d+)?$/;
// 14'6", 14' 6, 14-6, 14ft 6in, 14 ft. Always read as feet and inches, whatever the mode.
const EXPLICIT = /^(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet|foot|-)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in\.?|inch(?:es)?)?)?$/i;

const INVALID: DimensionResult = { ok: false, reason: 'INVALID' };

/**
 * Turns the size text as written on the photo into decimal feet.
 *  - decimal mode: "10.5" -> 10.5 ft
 *  - feet_inches mode: "10.8" -> 10 ft 8 in, "10.10" -> 10 ft 10 in, "10.1" -> 10 ft 1 in
 * Pure function, no I/O.
 */
export function parseDimension(raw: string | null | undefined, mode: CalcMode, unit: Unit): DimensionResult {
  const s = (raw ?? '').trim();
  if (s === '') return { ok: false, reason: 'MISSING' };

  const explicit = EXPLICIT.exec(s);
  if (explicit) {
    const inches = explicit[2] ? new D(explicit[2]) : new D(0);
    if (inches.gte(12)) return INVALID;
    return { ok: true, feet: new D(explicit[1]).plus(inches.div(12)) };
  }

  if (!PLAIN.test(s)) return INVALID;
  if (unit === 'm') return { ok: true, feet: new D(s).mul(METRE_TO_FEET) };
  if (mode === 'decimal') return { ok: true, feet: new D(s) };

  const [whole, fraction] = s.split('.');
  if (fraction === undefined) return { ok: true, feet: new D(whole) };
  if (fraction.length > 2) return INVALID;
  const inches = parseInt(fraction, 10);
  if (inches > 11) return INVALID;
  return { ok: true, feet: new D(whole).plus(new D(inches).div(12)) };
}
