import { CalcItem, CalcRate, calculate } from './calculation';
import { D } from '../lib/decimal';
import { CalcMode, RateType, Unit } from '../lib/types';

/**
 * An INDEPENDENT second implementation using exact whole-number fractions (BigInt).
 * It shares no code with the real calculation. Thousands of random estimates must match to the paisa.
 */
type Rat = { n: bigint; d: bigint };
const mul = (a: Rat, b: Rat): Rat => ({ n: a.n * b.n, d: a.d * b.d });
const fromDecimal = (s: string): Rat => {
  const [w, f = ''] = s.split('.');
  return { n: BigInt(w + f), d: 10n ** BigInt(f.length) };
};
/** floor(x * scale + 1/2) for x >= 0: round half up. */
const roundHalfUp = (x: Rat, scale: bigint): bigint => (2n * x.n * scale + x.d) / (2n * x.d);
const money = (cents: bigint) => `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
const thousandths = (q: bigint) => `${q / 1000n}.${(q % 1000n).toString().padStart(3, '0')}`;

function refFeet(text: string, mode: CalcMode, unit: Unit): Rat {
  const [w, f] = text.split('.');
  let feet: Rat = unit !== 'm' && mode === 'feet_inches' && f !== undefined ? { n: BigInt(w) * 12n + BigInt(f), d: 12n } : fromDecimal(text);
  if (unit === 'm') feet = mul(feet, { n: 328084n, d: 100000n });
  return feet;
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

      const sizeText = (unit: Unit): string => {
        const whole = int(1, 60);
        if (mode === 'feet_inches' && unit === 'ft') {
          const kind = int(0, 3);
          if (kind === 0) return String(whole);
          const inches = int(0, 11);
          return `${whole}.${kind === 1 && inches >= 10 ? inches : kind === 2 ? String(inches).padStart(2, '0') : inches}`;
        }
        const decimals = int(0, 3);
        return decimals === 0 ? String(whole) : `${whole}.${String(int(0, 10 ** decimals - 1)).padStart(decimals, '0')}`;
      };
      const rateText = (): string => {
        const decimals = int(0, 4);
        const whole = int(1, 999);
        return decimals === 0 ? String(whole) : `${whole}.${String(int(0, 10 ** decimals - 1)).padStart(decimals, '0')}`;
      };

      for (let run = 0; run < Number(process.env.REF_RUNS ?? 500); run++) {
        const cats = ['a', 'b', 'c'];
        const rates: Record<string, CalcRate> = {};
        const rateRaw: Record<string, { value: string; per: RateType }> = {};
        for (const c of cats) {
          const v = rateText();
          const per = pick(['area', 'length', 'count'] as const);
          rates[c] = { value: new D(v), per, label: c };
          rateRaw[c] = { value: v, per };
        }
        const items: CalcItem[] = [];
        for (let i = 0; i < 8; i++) {
          const unit: Unit = rand() < 0.2 ? 'm' : 'ft';
          items.push({
            id: `i${i}`, categoryKey: pick(cats), label: `L${i}`,
            length: sizeText(unit), breadth: rand() < 0.1 ? null : sizeText(unit),
            count: rand() < 0.5 ? null : int(1, 20), unit,
          });
        }

        const actual = calculate(items, rates, mode);

        // expected, computed independently
        const expectedGroups = new Map<string, { lines: { id: string; qty: string; amount: string }[]; cents: bigint }>();
        const expectedInvalid: string[] = [];
        let grand = 0n;
        for (const it of items) {
          const r = rateRaw[it.categoryKey];
          let qty: Rat;
          if (r.per === 'area') {
            if (it.breadth === null) { expectedInvalid.push(it.id); continue; }
            qty = mul(refFeet(it.length as string, mode, it.unit), refFeet(it.breadth, mode, it.unit));
          } else if (r.per === 'length') {
            qty = refFeet(it.length as string, mode, it.unit);
          } else {
            qty = { n: BigInt(it.count ?? 1), d: 1n };
          }
          const cents = roundHalfUp(mul(qty, fromDecimal(r.value)), 100n);
          const g = expectedGroups.get(it.categoryKey) ?? { lines: [], cents: 0n };
          g.lines.push({ id: it.id, qty: thousandths(roundHalfUp(qty, 1000n)), amount: money(cents) });
          g.cents += cents;
          expectedGroups.set(it.categoryKey, g);
          grand += cents;
        }

        expect(actual.invalid.map((x) => x.id)).toEqual(expectedInvalid);
        expect(actual.groups.map((g) => g.categoryKey)).toEqual([...expectedGroups.keys()]);
        for (const g of actual.groups) {
          const exp = expectedGroups.get(g.categoryKey)!;
          expect(g.items.map((l) => ({ id: l.id, qty: l.qty, amount: l.amount }))).toEqual(exp.lines);
          expect(g.subtotal).toBe(money(exp.cents));
        }
        expect(actual.grandTotal).toBe(money(grand));
      }
    });
  }
});
