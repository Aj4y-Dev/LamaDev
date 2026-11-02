import { CalcItem, CalcRate, calculate } from './calculation';
import { D } from '../lib/decimal';
import { CalcMode, RateType, Unit } from '../lib/types';

/**
 * An INDEPENDENT second implementation using exact whole-number fractions (BigInt).
 * It shares no code with the real calculation. Random estimates (lines, products, sums, both modes,
 * feet and metres) must match to the paisa: every line quantity, every group total, the amounts and the grand total.
 */
type Rat = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
const norm = (r: Rat): Rat => {
  const g = gcd(r.n < 0n ? -r.n : r.n, r.d) || 1n;
  return { n: r.n / g, d: r.d / g };
};
const mul = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.n, d: a.d * b.d });
const add = (a: Rat, b: Rat): Rat => norm({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const fromDecimal = (s: string): Rat => {
  const [w, f = ''] = s.split('.');
  return norm({ n: BigInt(w + f), d: 10n ** BigInt(f.length) });
};
/** floor(x * scale + 1/2) for x >= 0: round half up. */
const roundHalfUp = (x: Rat, scale: bigint): bigint => (2n * x.n * scale + x.d) / (2n * x.d);
const money = (cents: bigint) => `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
const tenThousandths = (s: string): bigint => {
  const [w, f = ''] = s.split('.');
  return BigInt(w + (f + '0000').slice(0, 4));
};
const METRE: Rat = { n: 328084n, d: 100000n };

function refFeet(text: string, mode: CalcMode, unit: Unit): Rat {
  const [w, f] = text.split('.');
  let feet: Rat = unit !== 'm' && mode === 'feet_inches' && f !== undefined ? norm({ n: BigInt(w) * 12n + BigInt(f), d: 12n }) : fromDecimal(text);
  if (unit === 'm') feet = mul(feet, METRE);
  return feet;
}

/** Quantity of an expression line, computed the slow exact way. */
function refExpr(expr: string, per: RateType, mode: CalcMode, unit: Unit): Rat {
  let total: Rat = { n: 0n, d: 1n };
  for (const term of expr.split('+').map((t) => t.trim())) {
    const factors = term.split('x').map((f) => f.trim());
    if (per === 'count') total = add(total, { n: BigInt(factors[0]), d: 1n });
    else if (per === 'length') total = add(total, refFeet(factors[0], mode, unit));
    else if (factors.length === 1) total = add(total, unit === 'm' ? mul(fromDecimal(factors[0]), mul(METRE, METRE)) : fromDecimal(factors[0]));
    else total = add(total, mul(refFeet(factors[0], mode, unit), refFeet(factors[1], mode, unit)));
  }
  return total;
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('calculation vs independent exact reference', () => {
  for (const mode of ['decimal', 'feet_inches'] as const) {
    it(`matches the exact reference on random estimates (${mode})`, () => {
      const rand = rng(mode === 'decimal' ? 12345 : 67890);
      const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
      const pick = <T,>(a: readonly T[]): T => a[int(0, a.length - 1)];
      const decimalText = (maxWhole: number, maxDecimals: number): string => {
        const decimals = int(0, maxDecimals);
        const whole = int(1, maxWhole);
        return decimals === 0 ? String(whole) : `${whole}.${String(int(0, 10 ** decimals - 1)).padStart(decimals, '0')}`;
      };
      const sizeText = (unit: Unit): string => {
        if (mode === 'feet_inches' && unit === 'ft') {
          const whole = int(1, 60);
          const kind = int(0, 3);
          if (kind === 0) return String(whole);
          const inches = int(0, 11);
          return `${whole}.${kind === 1 && inches >= 10 ? inches : kind === 2 ? String(inches).padStart(2, '0') : inches}`;
        }
        return decimalText(60, 3);
      };
      const exprText = (per: RateType, unit: Unit): string => {
        const terms: string[] = [];
        for (let t = int(1, 3); t > 0; t--) {
          if (per === 'count') terms.push(String(int(1, 40)));
          else if (per === 'length') terms.push(sizeText(unit));
          else terms.push(rand() < 0.35 ? decimalText(300, 2) : `${sizeText(unit)} x ${sizeText(unit)}`);
        }
        return terms.join(' + ');
      };

      for (let run = 0; run < Number(process.env.REF_RUNS ?? 500); run++) {
        const cats = ['a', 'b', 'c'];
        const rates: Record<string, CalcRate> = {};
        const raw: Record<string, { value: string; per: RateType }> = {};
        for (const c of cats) {
          const v = decimalText(999, 4);
          const per = pick(['area', 'length', 'count'] as const);
          rates[c] = { value: new D(v), per, label: c };
          raw[c] = { value: v, per };
        }
        const items: CalcItem[] = [];
        for (let i = 0; i < 8; i++) {
          const unit: Unit = rand() < 0.2 ? 'm' : 'ft';
          const categoryKey = pick(cats);
          const useExpr = rand() < 0.6;
          items.push({
            id: `i${i}`, categoryKey, label: `L${i}`, unit,
            // when an expression is present the old fields must be ignored, so give them junk
            length: useExpr ? 'abc' : sizeText(unit),
            breadth: useExpr ? 'abc' : rand() < 0.1 ? null : sizeText(unit),
            count: useExpr ? null : rand() < 0.5 ? null : int(1, 20),
            expr: useExpr ? exprText(raw[categoryKey].per, unit) : null,
          });
        }

        const actual = calculate(items, rates, mode);

        // expected, computed independently
        type G = { lines: { id: string; qty: bigint; amount: string }[]; total: Rat };
        const expected = new Map<string, G>();
        const expectedInvalid: string[] = [];
        for (const it of items) {
          const r = raw[it.categoryKey];
          let qty: Rat;
          if (it.expr) qty = refExpr(it.expr, r.per, mode, it.unit);
          else if (r.per === 'area') {
            if (it.breadth === null) { expectedInvalid.push(it.id); continue; }
            qty = mul(refFeet(it.length as string, mode, it.unit), refFeet(it.breadth, mode, it.unit));
          } else if (r.per === 'length') qty = refFeet(it.length as string, mode, it.unit);
          else qty = { n: BigInt(it.count ?? 1), d: 1n };
          const g = expected.get(it.categoryKey) ?? { lines: [], total: { n: 0n, d: 1n } };
          g.lines.push({ id: it.id, qty: roundHalfUp(qty, 10000n), amount: money(roundHalfUp(mul(qty, fromDecimal(r.value)), 100n)) });
          g.total = add(g.total, qty);
          expected.set(it.categoryKey, g);
        }

        expect(actual.invalid.map((x) => x.id)).toEqual(expectedInvalid);
        expect(actual.groups.map((g) => g.categoryKey)).toEqual([...expected.keys()]);
        let grand = 0n;
        for (const g of actual.groups) {
          const exp = expected.get(g.categoryKey)!;
          expect(g.items.map((l) => ({ id: l.id, qty: tenThousandths(l.qty), amount: l.amount }))).toEqual(exp.lines);
          expect(tenThousandths(g.totalQty)).toBe(roundHalfUp(exp.total, 10000n));
          const cents = roundHalfUp(mul(exp.total, fromDecimal(raw[g.categoryKey].value)), 100n); // ONE rounding: total quantity x rate
          expect(g.subtotal).toBe(money(cents));
          grand += cents;
        }
        expect(actual.grandTotal).toBe(money(grand));
      }
    });
  }
});
