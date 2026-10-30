import { compare, hash } from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { one } from '../db';
import { pool } from '../db';
import { conflict, notFound, unauthorized } from '../lib/errors';
import { parse } from '../lib/validate';
import { requireAuth, userOf } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { ok } from '../lib/http';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

interface UserRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  language: 'en' | 'ne';
}

function issue(user: { id: string; email: string | null }) {
  const token = jwt.sign({ sub: user.id, email: user.email }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  return { token, user: { id: user.id, email: user.email } };
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const { email, password } = parse(credentials, req.body);
  const exists = await one<UserRow>(pool, 'select id from users where email = $1', [email]);
  if (exists) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  const created = await one<UserRow>(pool, 'insert into users (email, password_hash) values ($1, $2) returning id, email', [email, await hash(password, 10)]);
  ok(res, issue(created as UserRow), 201);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(credentials, req.body);
  const user = await one<UserRow>(pool, 'select id, email, password_hash from users where email = $1', [email]);
  const valid = user?.password_hash ? await compare(password, user.password_hash) : false;
  if (!user || !valid) throw unauthorized('Wrong email or password', 'INVALID_CREDENTIALS');
  ok(res, issue(user));
});

export const usersRouter = Router();
usersRouter.get('/me', requireAuth, async (req, res) => {
  const u = await one<UserRow>(pool, 'select id, email, language from users where id = $1', [userOf(req).id]);
  if (!u) throw notFound('User not found');
  ok(res, { id: u.id, email: u.email, language: u.language });
});
