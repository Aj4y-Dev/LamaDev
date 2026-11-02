import { CalcMode, RateType, Unit } from '../lib/types';
import { D, Ratio } from '../lib/decimal';
import { parseDimension } from './dimension';
import { MAX_AREA_SQFT, tooLarge } from './strategies';

export type ExprResult = { ok: true; qty: Ratio } | { ok: false; reason: string };

const PLAIN = /^\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;
const SQ_METRE_IN_SQ_FEET = new D('3.28084').pow(2); // 10.7639111056 exactly
const ZERO = new D(0);
const ONE = new D(1);
const bad = (reason: string): ExprResult => ({ ok: false, reason });

/** Exact fraction addition. Denominators here are 1, 12 or 144, so they always divide each other. */
export function addRatio(a: Ratio, b: Ratio): Ratio {
  if (a.d.eq(b.d)) return { n: a.n.plus(b.n), d: a.d };
  if (a.d.mod(b.d).isZero()) return { n: a.n.plus(b.n.mul(a.d.div(b.d))), d: a.d };
  if (b.d.mod(a.d).isZero()) return { n: b.n.plus(a.n.mul(b.d.div(a.d))), d: b.d };
  return { n: a.n.mul(b.d).plus(b.n.mul(a.d)), d: a.d.mul(b.d) };
}

/**
 * Evaluates one line of a measurement sheet, such as "13 x 11.9", "119.6 + 16.5" or "35.6".
 * What the line means depends on the work's rate type:
 *   area:   "A x B" is length x breadth (read with the calculation mode, so 10.8 can mean 10 ft 8 in).
 *           A lone number "A" is an area already worked out, in sq ft, always decimal.
 *   length: each term is a single length.
 *   count:  each term is a whole number of pieces.
 * Terms joined with "+" are added. Everything stays an exact fraction. Pure function, no I/O.
 */
export function evaluateExpression(expr: string, per: RateType, mode: CalcMode, unit: Unit): ExprResult {
  const text = expr.trim().toLowerCase();
  if (text === '') return bad('MISSING_EXPRESSION');

  let total: Ratio = { n: ZERO, d: ONE };
  for (const term of text.split('+').map((t) => t.trim())) {
    const factors = term.split('x').map((f) => f.trim());
    if (term === '' || factors.some((f) => f === '')) return bad('INVALID_EXPRESSION');

    if (per === 'count') {
      if (factors.length !== 1 || !INTEGER.test(factors[0]) || factors[0].length > 9) return bad('INVALID_COUNT');
      total = addRatio(total, { n: new D(factors[0]), d: ONE });
      continue;
    }

    if (per === 'length') {
      if (factors.length !== 1) return bad('INVALID_EXPRESSION');
      const p = parseDimension(factors[0], mode, unit);
      if (!p.ok) return bad('INVALID_DIMENSION');
      if (tooLarge(p.feet)) return bad('DIMENSION_TOO_LARGE');
      total = addRatio(total, p.feet);
      continue;
    }

    // area
    if (factors.length === 1) {
      const f = factors[0];
      if (!PLAIN.test(f) || f.replace(/\D/g, '').length > 12) return bad('INVALID_DIMENSION');
      const n = unit === 'm' ? new D(f).mul(SQ_METRE_IN_SQ_FEET) : new D(f);
      if (n.gt(MAX_AREA_SQFT)) return bad('DIMENSION_TOO_LARGE');
      total = addRatio(total, { n, d: ONE });
    } else if (factors.length === 2) {
      const a = parseDimension(factors[0], mode, unit);
      const b = parseDimension(factors[1], mode, unit);
      if (!a.ok || !b.ok) return bad('INVALID_DIMENSION');
      if (tooLarge(a.feet) || tooLarge(b.feet)) return bad('DIMENSION_TOO_LARGE');
      total = addRatio(total, { n: a.feet.n.mul(b.feet.n), d: a.feet.d.mul(b.feet.d) });
    } else {
      return bad('INVALID_EXPRESSION'); // three or more factors: we do not guess what it means
    }
  }
  if (total.n.lte(0)) return bad('INVALID_DIMENSION');
  return { ok: true, qty: total };
}
