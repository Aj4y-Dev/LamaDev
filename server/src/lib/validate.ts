import { z } from 'zod';
import { badRequest } from './errors';

/** Parses untrusted input. Throws a VALIDATION_ERROR with readable details. */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  throw badRequest(
    'Some details are not valid',
    r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  );
}

export const uuidSchema = z.string().uuid();
