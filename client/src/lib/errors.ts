import { ApiError } from '@/api/client';

const KNOWN = ['EXTRACTION_FAILED', 'VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED', 'NETWORK_ERROR', 'TIMEOUT'];

/** Maps any thrown value to an i18n key under `errors.*`. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError && KNOWN.includes(error.code)) return `errors.${error.code}`;
  return 'errors.generic';
}
