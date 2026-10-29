import { RateType } from '../../common/types';
import { Dec } from '../../common/utils/decimal';

export interface PricingInput {
  lengthFt: Dec | null;
  breadthFt: Dec | null;
  count: number | null;
}

export interface PricingStrategy {
  readonly type: RateType;
  readonly unitLabel: string;
  readonly needsLength: boolean;
  readonly needsBreadth: boolean;
  /** Returns a reason code when the item cannot be priced, otherwise null. */
  validate(item: PricingInput): string | null;
  quantity(item: PricingInput): Dec;
}
