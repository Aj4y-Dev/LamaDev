import { Injectable } from '@nestjs/common';
import { RateType } from '../../common/types';
import { AreaStrategy } from './area.strategy';
import { CountStrategy } from './count.strategy';
import { LengthStrategy } from './length.strategy';
import { PricingStrategy } from './pricing-strategy.interface';

/** Add a new measuring type by adding one class here. Nothing else changes. */
@Injectable()
export class StrategyRegistry {
  private readonly byType = new Map<RateType, PricingStrategy>(
    [new AreaStrategy(), new LengthStrategy(), new CountStrategy()].map((s) => [s.type, s]),
  );

  get(type: RateType): PricingStrategy {
    const s = this.byType.get(type);
    if (!s) throw new Error(`No pricing strategy for ${type}`);
    return s;
  }
}
