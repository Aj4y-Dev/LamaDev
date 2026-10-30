import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const tooMany = (_req: Request, res: Response) => {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a few minutes.' } });
};

/** Slows down password guessing. */
export const authLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, handler: tooMany });

/** Photo reading costs CPU: 20 photos per hour per user. Must run after requireAuth. */
export const extractLimiter = rateLimit({
  windowMs: 3_600_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ''),
  handler: tooMany,
});
