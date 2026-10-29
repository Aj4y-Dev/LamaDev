import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractionService } from './extraction.service';
import { EXTRACTION_PROVIDER } from './providers/extraction-provider.interface';
import { MockExtractionProvider } from './providers/mock.provider';
import { TesseractProvider } from './providers/tesseract.provider';

@Module({
  providers: [
    ExtractionService,
    TesseractProvider,
    MockExtractionProvider,
    {
      provide: EXTRACTION_PROVIDER,
      inject: [ConfigService, TesseractProvider, MockExtractionProvider],
      useFactory: (config: ConfigService, tesseract: TesseractProvider, mock: MockExtractionProvider) =>
        config.get<string>('EXTRACTION_MODE') === 'mock' ? mock : tesseract,
    },
  ],
  exports: [ExtractionService],
})
export class ExtractionModule {}
