import { D, Dec } from '../../common/utils/decimal';
import { PricingInput, PricingStrategy } from './pricing-strategy.interface';

export class AreaStrategy implements PricingStrategy {
  readonly type = 'area' as const;
  readonly unitLabel = 'sqft';
  readonly needsLength = true;
  readonly needsBreadth = true;

  validate(i: PricingInput): string | null {
    if (!i.lengthFt) return 'MISSING_LENGTH';
    if (!i.breadthFt) return 'MISSING_BREADTH';
    if (i.lengthFt.lte(0) || i.breadthFt.lte(0)) return 'INVALID_DIMENSION';
    return null;
  }
  quantity(i: PricingInput): Dec {
    return (i.lengthFt ?? new D(0)).mul(i.breadthFt ?? new D(0));
  }
}
