import { Injectable } from '@nestjs/common';
import { CalcMode, RateType, Unit, UNKNOWN_CATEGORY } from '../common/types';
import { D, Dec } from '../common/utils/decimal';
import { parseDimension } from './dimension';
import { StrategyRegistry } from './strategies/strategy.registry';

export interface CalcItem {
  id: string;
  categoryKey: string;
  label: string;
  length: string | null;
  breadth: string | null;
  count: number | null;
  unit: Unit;
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
  grandTotal: string;
  currency: 'NPR';
}

const ZERO = new D(0);

/**
 * Pure calculation. No I/O. The AI never does arithmetic: this class is the only place money is computed.
 * amount = quantity x rate, rounded once per line to 2 decimals (ROUND_HALF_UP).
 */
@Injectable()
export class CalculationService {
  constructor(private readonly registry: StrategyRegistry) {}

  calculate(items: CalcItem[], rates: Record<string, CalcRate>, mode: CalcMode): CalcResult {
    const invalid: { id: string; reason: string }[] = [];
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

      const strategy = this.registry.get(rate.per);
      let lengthFt: Dec | null = null;
      let breadthFt: Dec | null = null;

      if (strategy.needsLength) {
        const p = parseDimension(item.length, mode, item.unit);
        if (p.ok) lengthFt = p.feet;
        else if (p.reason === 'INVALID') {
          invalid.push({ id: item.id, reason: 'INVALID_DIMENSION' });
          continue;
        }
      }
      if (strategy.needsBreadth) {
        const p = parseDimension(item.breadth, mode, item.unit);
        if (p.ok) breadthFt = p.feet;
        else if (p.reason === 'INVALID') {
          invalid.push({ id: item.id, reason: 'INVALID_DIMENSION' });
          continue;
        }
      }

      const input = { lengthFt, breadthFt, count: item.count };
      const reason = strategy.validate(input);
      if (reason) {
        invalid.push({ id: item.id, reason });
        continue;
      }

      const qty = strategy.quantity(input);
      const amount = qty.mul(rate.value).toDecimalPlaces(2, D.ROUND_HALF_UP);

      let g = groups.get(item.categoryKey);
      if (!g) {
        g = { rate, lines: [], amounts: [] };
        groups.set(item.categoryKey, g);
      }
      g.lines.push({
        id: item.id,
        label: item.label,
        size: this.sizeText(rate.per, item),
        qty: qty.toFixed(3),
        unit: strategy.unitLabel,
        amount: amount.toFixed(2),
      });
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
        rate: { value: g.rate.value.toFixed(2), per: g.rate.per },
        items: g.lines,
        subtotal: subtotal.toFixed(2),
      });
    }

    return { mode, groups: out, invalid, grandTotal: grand.toFixed(2), currency: 'NPR' };
  }

  private sizeText(per: RateType, item: CalcItem): string {
    if (per === 'area') return `${item.length ?? ''} × ${item.breadth ?? ''}`.trim();
    if (per === 'length') return item.length ?? '';
    return `× ${item.count ?? 1}`;
  }
}
