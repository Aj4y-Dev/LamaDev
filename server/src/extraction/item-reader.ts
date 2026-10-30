import type { RawItem } from './normalizer';

/** Anything that can read measurement lines from a JPEG. Swap implementations without touching the rest. */
export interface ItemReader {
  read(image: Buffer): Promise<RawItem[]>;
}
