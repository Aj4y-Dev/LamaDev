import { RateType } from '../lib/types';
import { D, Ratio } from '../lib/decimal';

export interface PricingInput {
  lengthFt: Ratio | null;
  breadthFt: Ratio | null;
  count: number | null;
}

export interface PricingStrategy {
  readonly type: RateType;
  readonly unitLabel: string;
  readonly needsLength: boolean;
  readonly needsBreadth: boolean;
  /** Returns a reason code when the item cannot be priced, otherwise null. */
  validate(item: PricingInput): string | null;
  /** Quantity as an exact fraction. Not divided here: the calculation divides once at the end. */
  quantity(item: PricingInput): Ratio;
}

/** Longest single side we accept. A bigger number is almost always a missing decimal point. */
export const MAX_DIMENSION_FT = 500;
const tooLarge = (r: Ratio) => r.n.gt(r.d.mul(MAX_DIMENSION_FT));
const notPositive = (r: Ratio) => r.n.lte(0);
const ONE = new D(1);

const areaStrategy: PricingStrategy = {
  type: 'area',
  unitLabel: 'sqft',
  needsLength: true,
  needsBreadth: true,
  // A line with no breadth is not an incomplete entry: a contractor sometimes already knows a
  // room's total square footage and writes that number alone instead of two dimensions to multiply.
  // That single number IS the area, so it is priced as-is rather than rejected as MISSING_BREADTH.
  validate(i) {
    if (!i.lengthFt) return 'MISSING_LENGTH';
    if (notPositive(i.lengthFt)) return 'INVALID_DIMENSION';
    if (tooLarge(i.lengthFt)) return 'DIMENSION_TOO_LARGE';
    if (i.breadthFt && (notPositive(i.breadthFt) || tooLarge(i.breadthFt))) {
      return notPositive(i.breadthFt) ? 'INVALID_DIMENSION' : 'DIMENSION_TOO_LARGE';
    }
    return null;
  },
  quantity: (i) => {
    const l = i.lengthFt as Ratio;
    if (!i.breadthFt) return l;
    return { n: l.n.mul(i.breadthFt.n), d: l.d.mul(i.breadthFt.d) };
  },
};

const lengthStrategy: PricingStrategy = {
  type: 'length',
  unitLabel: 'ft',
  needsLength: true,
  needsBreadth: false,
  validate(i) {
    if (!i.lengthFt) return 'MISSING_LENGTH';
    if (notPositive(i.lengthFt)) return 'INVALID_DIMENSION';
    if (tooLarge(i.lengthFt)) return 'DIMENSION_TOO_LARGE';
    return null;
  },
  quantity: (i) => i.lengthFt ?? { n: new D(0), d: ONE },
};

const countStrategy: PricingStrategy = {
  type: 'count',
  unitLabel: 'pcs',
  needsLength: false,
  needsBreadth: false,
  validate: (i) => (i.count !== null && i.count <= 0 ? 'INVALID_COUNT' : null),
  quantity: (i) => ({ n: new D(i.count ?? 1), d: ONE }),
};

/** Add a new measuring type by adding one strategy here. Nothing else changes. */
const REGISTRY = new Map<RateType, PricingStrategy>([areaStrategy, lengthStrategy, countStrategy].map((s) => [s.type, s]));

export function strategyFor(type: RateType): PricingStrategy {
  const s = REGISTRY.get(type);
  if (!s) throw new Error(`No pricing strategy for ${type}`);
  return s;
}
