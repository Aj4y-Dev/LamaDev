import type { Response } from 'express';

/** Success envelope: { data }. */
export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ data: data ?? null });
}
