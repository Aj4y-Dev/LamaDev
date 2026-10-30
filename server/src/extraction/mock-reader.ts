import type { ItemReader } from './item-reader';
import type { RawItem } from './normalizer';

/** For testing the app without a real photo (EXTRACTION_MODE=mock). */
export class MockReader implements ItemReader {
  async read(): Promise<RawItem[]> {
    return [
      { label: 'Hall', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
      { label: 'Bedroom', length: '14.0', breadth: '9.8', count: null, unit: 'ft' },
      { label: 'Passage', length: '20.4', breadth: null, count: null, unit: 'ft' },
    ];
  }
}
