import type { RawItem } from './normalizer';

export interface ReadResult {
  items: RawItem[];
  /** Lines of text on the photo that contained digits but could not be understood as a measurement. */
  skipped: number;
}

/** Anything that can read measurement lines from a JPEG. Swap implementations without touching the rest. */
export interface ItemReader {
  read(image: Buffer): Promise<ReadResult>;
}
