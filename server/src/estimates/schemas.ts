import { z } from 'zod';
import { CALC_MODES, RATE_TYPES, UNITS } from '../lib/types';

const KEY = /^[a-z0-9_]{1,64}$/;

export const extractFieldsSchema = z.object({
  categoryKey: z.string().regex(KEY, 'categoryKey must be lowercase letters, digits or _ (max 64)'),
  estimateId: z.string().uuid().optional(),
});

const itemSchema = z.object({
  id: z.string().optional(),
  categoryKey: z.string().regex(KEY),
  label: z.string().max(200),
  length: z.string().max(32).nullish(),
  breadth: z.string().max(32).nullish(),
  count: z.number().int().min(0).max(1_000_000).nullish(),
  unit: z.enum(UNITS),
  uncertain: z.boolean().optional(), // sent back by the app; the server keeps its own value
}).strict();

export const itemsBodySchema = z.object({ items: z.array(itemSchema).max(500) }).strict();

const rateSchema = z.object({
  value: z.string().regex(/^\d{1,10}(\.\d{1,4})?$/, 'rate must be a positive number with at most 4 decimals'),
  per: z.enum(RATE_TYPES),
  label: z.string().max(100).optional(),
}).strict();

export const calculateBodySchema = z.object({
  mode: z.enum(CALC_MODES).optional(),
  rates: z.record(z.string().regex(KEY), rateSchema),
}).strict();
