export interface ExtractionProvider {
  /** Returns JSON text shaped like {"items":[...]} for a JPEG image. ExtractionService validates it. */
  extract(image: Buffer): Promise<string>;
}
export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');
