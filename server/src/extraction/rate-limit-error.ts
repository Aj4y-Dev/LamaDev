/**
 * A vision provider told us to slow down (its quota, or a shared-capacity limit, not a problem with the
 * photo). Any ItemReader can throw this regardless of provider, so extraction.service.ts can give the
 * client an honest "try again shortly" instead of blaming the photo. Retrying immediately never helps —
 * a per-minute quota resets on its own clock, not ours — so readItems() does not retry this error at all.
 */
export class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}
