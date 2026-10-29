import { Injectable } from '@nestjs/common';
import { ExtractionProvider } from './extraction-provider.interface';

/** For local testing without an API key (EXTRACTION_MODE=mock) and for unit tests. */
@Injectable()
export class MockExtractionProvider implements ExtractionProvider {
  async extract(): Promise<string> {
    return JSON.stringify({
      items: [
        { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
        { label: 'Bedroom', length: '14.0', breadth: '9.8', count: null, unit: 'ft' },
        { label: 'Passage', length: '20.4', breadth: null, count: null, unit: 'ft' },
      ],
    });
  }
}
