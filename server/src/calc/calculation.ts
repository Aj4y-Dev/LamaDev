import { CalcMode, RateType, Unit, UNKNOWN_CATEGORY } from '../lib/types';
import { D, Dec, Ratio } from '../lib/decimal';
import { parseDimension } from './dimension';
import { addRatio, evaluateExpression } from './expression';
import { strategyFor } from './strategies';

export interface CalcItem {
  id: string;
  categoryKey: string;
  label: string;
  /** Older items have separate length and breadth. */
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
  /** The line as written on the sheet, e.g. "13 x 11.9" or "119.6 + 16.5". Used when present. */
  expr?: string | null;
  /** The result the writer put after "=", used to double-check what was read. */
  written?: string | null;
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
  /** The line as written, tidied: "13 × 11.9". */
  size: string;
  /** The quantity of this line: sq ft, ft or pieces. */
  qty: string;
  unit: string;
  /** Informational: this line alone, rounded. The group amount is NOT the sum of these. */
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
  /** All lines added together, exactly. */
  totalQty: string;
  unit: string;
  /** totalQty x rate, rounded once to 2 decimals. */
  subtotal: string;
}
export interface CalcWarning {
  id: string;
  reason: 'CHECK_NUMBERS' | 'RESULT_MISMATCH';
  written?: string;
  computed?: string;
}
export interface CalcResult {
  mode: CalcMode;
  groups: CalcGroup[];
  invalid: { id: string; reason: string }[];
  /** Lines that ARE in the total but should be double-checked. */
  warnings: CalcWarning[];
  grandTotal: string;
  currency: 'NPR';
}

const ZERO = new D(0);
const ONE = new D(1);
const money = (r: Ratio, rate: Dec): Dec => r.n.mul(rate).div(r.d).toDecimalPlaces(2, D.ROUND_HALF_UP);
const showRate = (d: Dec): string => (d.decimalPlaces() <= 2 ? d.toFixed(2) : d.toFixed());
/** 154.7 -> "154.70", 128.125 -> "128.125", 10.08333... -> "10.0833". Display only. */
function fmtQty(d: Dec): string {
  const dp = d.decimalPlaces();
  return dp <= 4 ? d.toFixed(Math.max(2, dp)) : d.toDecimalPlaces(4, D.ROUND_HALF_UP).toFixed(4);
}
const WRITTEN_TOLERANCE = new D('0.01');

/**
 * Pure calculation, no I/O. This is the only place money is computed.
 *   quantity per line = sq ft, ft or pieces, kept as an exact fraction
 *   group quantity    = all the lines added together
 *   group amount      = group quantity x rate, rounded ONCE to 2 decimals (ROUND_HALF_UP)
 *   grand total       = sum of the group amounts
 * Lines that cannot be priced are returned in `invalid`. They are never dropped silently or guessed.
 */
export function calculate(items: CalcItem[], rates: Record<string, CalcRate>, mode: CalcMode): CalcResult {
  const invalid: { id: string; reason: string }[] = [];
  const warnings: CalcWarning[] = [];
  const groups = new Map<string, { rate: CalcRate; lines: CalcLine[]; qtys: Ratio[]; unit: string }>();

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
    const qty = quantityOf(item, rate.per, mode);
    if (!qty.ok) {
      invalid.push({ id: item.id, reason: qty.reason });
      continue;
    }
    const q = qty.qty;
    const exact = q.n.div(q.d);

    // Cross-check with the result the writer put after "=".
    let check = item.uncertain === true;
    const written = item.written && /^\d+(\.\d+)?$/.test(item.written) && item.unit !== 'm' ? new D(item.written) : null;
    if (written) {
      if (exact.minus(written).abs().gt(WRITTEN_TOLERANCE)) {
        warnings.push({ id: item.id, reason: 'RESULT_MISMATCH', written: item.written ?? undefined, computed: fmtQty(exact) });
        check = true;
      } else {
        check = false; // the writer's own result agrees with what we read: strong evidence the numbers are right
      }
    }
    if (check && !warnings.some((w) => w.id === item.id)) warnings.push({ id: item.id, reason: 'CHECK_NUMBERS' });

    let g = groups.get(item.categoryKey);
    if (!g) {
      g = { rate, lines: [], qtys: [], unit: strategy.unitLabel };
      groups.set(item.categoryKey, g);
    }
    g.lines.push({
      id: item.id,
      label: item.label,
      size: sizeText(item, rate.per),
      qty: fmtQty(exact),
      unit: strategy.unitLabel,
      amount: money(q, rate.value).toFixed(2),
      check,
    });
    g.qtys.push(q);
  }

  let grand: Dec = ZERO;
  const out: CalcGroup[] = [];
  for (const [categoryKey, g] of groups) {
    const total = g.qtys.reduce(addRatio, { n: ZERO, d: ONE });
    const subtotal = money(total, g.rate.value);
    grand = grand.plus(subtotal);
    out.push({
      categoryKey,
      label: g.rate.label,
      labelNe: g.rate.label,
      rate: { value: showRate(g.rate.value), per: g.rate.per },
      items: g.lines,
      totalQty: fmtQty(total.n.div(total.d)),
      unit: g.unit,
      subtotal: subtotal.toFixed(2),
    });
  }
  return { mode, groups: out, invalid, warnings, grandTotal: grand.toFixed(2), currency: 'NPR' };
}

type Qty = { ok: true; qty: Ratio } | { ok: false; reason: string };

function quantityOf(item: CalcItem, per: RateType, mode: CalcMode): Qty {
  if (item.expr && item.expr.trim() !== '') return evaluateExpression(item.expr, per, mode, item.unit);

  // Older items: separate length / breadth / count.
  const strategy = strategyFor(per);
  let lengthFt: Ratio | null = null;
  let breadthFt: Ratio | null = null;
  if (strategy.needsLength) {
    const p = parseDimension(item.length, mode, item.unit);
    if (p.ok) lengthFt = p.feet;
    else if (p.reason === 'INVALID') return { ok: false, reason: 'INVALID_DIMENSION' };
  }
  if (strategy.needsBreadth) {
    const p = parseDimension(item.breadth, mode, item.unit);
    if (p.ok) breadthFt = p.feet;
    else if (p.reason === 'INVALID') return { ok: false, reason: 'INVALID_DIMENSION' };
  }
  const input = { lengthFt, breadthFt, count: item.count };
  const reason = strategy.validate(input);
  return reason ? { ok: false, reason } : { ok: true, qty: strategy.quantity(input) };
}

function sizeText(item: CalcItem, per: RateType): string {
  const u = item.unit === 'm' ? ' m' : '';
  if (item.expr && item.expr.trim() !== '') return `${item.expr.trim().replace(/\s*x\s*/g, ' × ').replace(/\s*\+\s*/g, ' + ')}${u}`;
  if (per === 'area') return `${item.length ?? ''} × ${item.breadth ?? ''}${u}`.trim();
  if (per === 'length') return `${item.length ?? ''}${u}`.trim();
  return `× ${item.count ?? 1}`;
}
