import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { EXTRACTION_PROVIDER, ExtractionProvider } from './providers/extraction-provider.interface';
import { ExtractionResult, extractionResultSchema, parseModelJson } from './schemas/extraction-result.schema';

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(@Inject(EXTRACTION_PROVIDER) private readonly provider: ExtractionProvider) {}

  /** Calls the model, validates its JSON, retries once, then gives up with EXTRACTION_FAILED. */
  async extractItems(image: Buffer): Promise<ExtractionResult['items']> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const text = await this.provider.extract(image);
        const parsed = extractionResultSchema.parse(parseModelJson(text));
        if (parsed.items.length === 0) throw new Error('no items found');
        return parsed.items;
      } catch (err) {
        // Log only the reason. Never the image or the full model response.
        this.logger.warn(`extraction attempt ${attempt} failed: ${err instanceof Error ? err.name : 'error'}`);
      }
    }
    throw new UnprocessableEntityException({
      code: 'EXTRACTION_FAILED',
      message: 'We could not read this photo. Try a clearer photo.',
    });
  }
}
