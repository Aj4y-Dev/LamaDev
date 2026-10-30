import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { unauthorized } from '../lib/errors';
import type { AuthUser } from '../lib/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw unauthorized();
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub?: string; email?: string | null };
    if (!payload.sub) throw new Error('no subject');
    req.user = { id: payload.sub, email: payload.email ?? null };
    next();
  } catch {
    throw unauthorized();
  }
}

/** For routes that run after requireAuth. */
export function userOf(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
