import { Module } from '@nestjs/common';
import { CalculationService } from './calculation.service';
import { StrategyRegistry } from './strategies/strategy.registry';

@Module({ providers: [CalculationService, StrategyRegistry], exports: [CalculationService] })
export class CalculationModule {}
