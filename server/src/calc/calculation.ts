import { CalcMode, RateType, Unit, UNKNOWN_CATEGORY } from '../lib/types';
import { D, Dec, Ratio } from '../lib/decimal';
import { parseDimension } from './dimension';
import { strategyFor } from './strategies';

export interface CalcItem {
  id: string;
  categoryKey: string;
  label: string;
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
  /** The photo reader was not sure about the numbers on this line. */
  uncertain?: boolean;
}
export interface CalcRate {
  value: Dec;
  per: RateType;
  label: string;
}
export interface CalcLine {
  id: string;
  label: string;
  size: string;
  qty: string;
  unit: string;
  amount: string;
  /** True when the numbers should be double-checked against the photo. */
  check: boolean;
}
export interface CalcGroup {
  categoryKey: string;
  label: string;
  labelNe: string;
  rate: { value: string; per: RateType };
  items: CalcLine[];
  subtotal: string;
}
export interface CalcResult {
  mode: CalcMode;
  groups: CalcGroup[];
  invalid: { id: string; reason: string }[];
  /** Lines that ARE in the total but whose numbers the photo reader was unsure about. */
  warnings: { id: string; reason: 'CHECK_NUMBERS' }[];
  grandTotal: string;
  currency: 'NPR';
}

const ZERO = new D(0);
/** Shows the rate exactly as it was used: 85 -> "85.00", 12.345 -> "12.345". */
const showRate = (d: Dec): string => (d.decimalPlaces() <= 2 ? d.toFixed(2) : d.toFixed());

/**
 * Pure calculation, no I/O. This is the only place money is computed.
 *   quantity = by rate type (sq ft, ft or pieces)
 *   amount   = quantity x rate, rounded ONCE per line to 2 decimals (ROUND_HALF_UP)
 *   subtotal = sum of the rounded lines, grand total = sum of the subtotals
 * Lines that cannot be priced are returned in `invalid`. They are never dropped silently or guessed.
 */
export function calculate(items: CalcItem[], rates: Record<string, CalcRate>, mode: CalcMode): CalcResult {
  const invalid: { id: string; reason: string }[] = [];
  const warnings: { id: string; reason: 'CHECK_NUMBERS' }[] = [];
  const groups = new Map<string, { rate: CalcRate; lines: CalcLine[]; amounts: Dec[] }>();

  for (const item of items) {
    if (item.categoryKey === UNKNOWN_CATEGORY) {
      invalid.push({ id: item.id, reason: 'UNKNOWN_CATEGORY' });
      continue;
    }
    const rate = rates[item.categoryKey];
    if (!rate || rate.value.lte(0)) {
      invalid.push({ id: item.id, reason: 'NO_RATE' });
      continue;
    }

    const strategy = strategyFor(rate.per);
    let lengthFt: Ratio | null = null;
    let breadthFt: Ratio | null = null;
    let bad = false;

    if (strategy.needsLength) {
      const p = parseDimension(item.length, mode, item.unit);
      if (p.ok) lengthFt = p.feet;
      else if (p.reason === 'INVALID') bad = true;
    }
    if (strategy.needsBreadth) {
      const p = parseDimension(item.breadth, mode, item.unit);
      if (p.ok) breadthFt = p.feet;
      else if (p.reason === 'INVALID') bad = true;
    }
    if (bad) {
      invalid.push({ id: item.id, reason: 'INVALID_DIMENSION' });
      continue;
    }

    const input = { lengthFt, breadthFt, count: item.count };
    const reason = strategy.validate(input);
    if (reason) {
      invalid.push({ id: item.id, reason });
      continue;
    }

    // Multiply everything first, divide ONCE at the end. Dividing early (by 12) makes repeating decimals
    // that can land just below a half-paisa and round the wrong way.
    const q = strategy.quantity(input);
    const amount = q.n.mul(rate.value).div(q.d).toDecimalPlaces(2, D.ROUND_HALF_UP);

    let g = groups.get(item.categoryKey);
    if (!g) {
      g = { rate, lines: [], amounts: [] };
      groups.set(item.categoryKey, g);
    }
    g.lines.push({
      id: item.id,
      label: item.label,
      size: sizeText(rate.per, item),
      qty: q.n.div(q.d).toFixed(3),
      unit: strategy.unitLabel,
      amount: amount.toFixed(2),
      check: item.uncertain === true,
    });
    if (item.uncertain) warnings.push({ id: item.id, reason: 'CHECK_NUMBERS' });
    g.amounts.push(amount);
  }

  let grand: Dec = ZERO;
  const out: CalcGroup[] = [];
  for (const [categoryKey, g] of groups) {
    const subtotal = g.amounts.reduce((a, b) => a.plus(b), ZERO);
    grand = grand.plus(subtotal);
    out.push({
      categoryKey,
      label: g.rate.label,
      labelNe: g.rate.label,
      rate: { value: showRate(g.rate.value), per: g.rate.per },
      items: g.lines,
      subtotal: subtotal.toFixed(2),
    });
  }
  return { mode, groups: out, invalid, warnings, grandTotal: grand.toFixed(2), currency: 'NPR' };
}

function sizeText(per: RateType, item: CalcItem): string {
  const u = item.unit === 'm' ? ' m' : '';
  if (per === 'area') return `${item.length ?? ''} × ${item.breadth ?? ''}${u}`.trim();
  if (per === 'length') return `${item.length ?? ''}${u}`.trim();
  return `× ${item.count ?? 1}`;
}
