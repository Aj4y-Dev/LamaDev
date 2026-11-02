import type { ItemReader, ReadResult } from './item-reader';

/** For testing the app without a real photo (EXTRACTION_MODE=mock). */
export class MockReader implements ItemReader {
  async read(): Promise<ReadResult> {
    return { skipped: 0, items: [
      { label: 'Hall', expr: '12.6 x 10.3', length: '12.6', breadth: '10.3', count: null, unit: 'ft' },
      { label: 'Bedroom', expr: '14.0 x 9.8', length: '14.0', breadth: '9.8', count: null, unit: 'ft' },
      { label: 'Passage', expr: '20.4', length: '20.4', breadth: null, count: null, unit: 'ft' },
    ] };
  }
}
