import { D, Dec } from '../../common/utils/decimal';
import { PricingInput, PricingStrategy } from './pricing-strategy.interface';

export class LengthStrategy implements PricingStrategy {
  readonly type = 'length' as const;
  readonly unitLabel = 'ft';
  readonly needsLength = true;
  readonly needsBreadth = false;

  validate(i: PricingInput): string | null {
    if (!i.lengthFt) return 'MISSING_LENGTH';
    if (i.lengthFt.lte(0)) return 'INVALID_DIMENSION';
    return null;
  }
  quantity(i: PricingInput): Dec {
    return i.lengthFt ?? new D(0);
  }
}
