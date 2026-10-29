import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationModule } from '../calculation/calculation.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { NormalizerModule } from '../normalizer/normalizer.module';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../storage/storage.module';
import { EstimateItem } from './estimate-item.entity';
import { Estimate } from './estimate.entity';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Estimate, EstimateItem]), ProjectsModule, ExtractionModule, NormalizerModule, CalculationModule, StorageModule],
  controllers: [EstimatesController],
  providers: [EstimatesService],
})
export class EstimatesModule {}
