import { unprocessable } from '../lib/errors';
import type { ItemReader } from './item-reader';
import type { RawItem } from './normalizer';

const MAX_ITEMS = 200;

/** Reads a photo and returns raw items, or gives up with EXTRACTION_FAILED. Retries once if the reader crashes. */
export async function readItems(reader: ItemReader, image: Buffer, warn: (m: string) => void = () => undefined): Promise<RawItem[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const items = await reader.read(image);
      if (items.length === 0) break; // reading worked, there was just nothing to read: retrying will not help
      return items.slice(0, MAX_ITEMS);
    } catch (err) {
      // Log only the reason, never the image or the full text.
      warn(`reading attempt ${attempt} failed: ${err instanceof Error ? err.message : 'error'}`);
    }
  }
  throw unprocessable('EXTRACTION_FAILED', 'We could not read this photo. Try a clearer photo.');
}
