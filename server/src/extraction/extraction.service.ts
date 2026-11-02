import { unprocessable } from '../lib/errors';
import type { ItemReader, ReadResult } from './item-reader';

const MAX_ITEMS = 200;

/** Reads a photo, or gives up with EXTRACTION_FAILED. Retries once if the reader crashes. */
export async function readItems(reader: ItemReader, image: Buffer, warn: (m: string) => void = () => undefined): Promise<ReadResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await reader.read(image);
      if (result.items.length === 0) break; // reading worked, there was just nothing to read: retrying will not help
      return { items: result.items.slice(0, MAX_ITEMS), skipped: result.skipped };
    } catch (err) {
      // Log only the reason, never the image or the full text.
      warn(`reading attempt ${attempt} failed: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  throw unprocessable('EXTRACTION_FAILED', 'We could not read this photo. You can type the lines in yourself.');
}
