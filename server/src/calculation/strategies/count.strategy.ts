import { D, Dec } from '../../common/utils/decimal';
import { PricingInput, PricingStrategy } from './pricing-strategy.interface';

export class CountStrategy implements PricingStrategy {
  readonly type = 'count' as const;
  readonly unitLabel = 'pcs';
  readonly needsLength = false;
  readonly needsBreadth = false;

  validate(i: PricingInput): string | null {
    return i.count !== null && i.count <= 0 ? 'INVALID_COUNT' : null;
  }
  quantity(i: PricingInput): Dec {
    return new D(i.count ?? 1);
  }
}
