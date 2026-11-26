import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  EXTRACTION_MODE: z.enum(['tesseract', 'mock', 'claude', 'gemini']).default('tesseract'),
  TESSERACT_LANGS: z.string().default('eng+nep'),
  OCR_DEBUG: z.enum(['true', 'false']).default('false'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  UPLOAD_DIR: z.string().default('./uploads'),
  CORS_ORIGINS: z.string().default(''),
}).superRefine((val, ctx) => {
  if (val.EXTRACTION_MODE === 'claude' && !val.ANTHROPIC_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ANTHROPIC_API_KEY'], message: 'required when EXTRACTION_MODE=claude' });
  }
  if (val.EXTRACTION_MODE === 'gemini' && !val.GEMINI_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GEMINI_API_KEY'], message: 'required when EXTRACTION_MODE=gemini' });
  }
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment (check your .env file):\n${lines}`);
  }
  return parsed.data;
}

/** Validated at startup. The server refuses to start if something required is missing. */
export const config = load();
