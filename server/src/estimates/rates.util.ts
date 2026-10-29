import { BadRequestException } from '@nestjs/common';
import { RATE_TYPES, RateInput, RateType } from '../common/types';
import { D } from '../common/utils/decimal';
import type { CalcRate } from '../calculation/calculation.service';

const KEY = /^[a-z0-9_]{1,64}$/;
const VALUE = /^\d{1,10}(\.\d{1,4})?$/;

function bad(message: string): never {
  throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

/** Validates the rates the client typed for this estimate. */
export function parseRates(raw: unknown): Record<string, RateInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('rates must be an object');
  const out: Record<string, RateInput> = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY.test(key)) bad(`Invalid work type key: ${key}`);
    if (!v || typeof v !== 'object') bad(`Invalid rate for ${key}`);
    const r = v as { value?: unknown; per?: unknown; label?: unknown };
    if (typeof r.value !== 'string' || !VALUE.test(r.value)) bad(`Invalid rate value for ${key}`);
    if (typeof r.per !== 'string' || !(RATE_TYPES as readonly string[]).includes(r.per)) bad(`Invalid rate type for ${key}`);
    const label = typeof r.label === 'string' ? r.label.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
    out[key] = { value: r.value, per: r.per as RateType, ...(label ? { label } : {}) };
  }
  return out;
}

export function toCalcRates(stored: Record<string, RateInput>): Record<string, CalcRate> {
  const out: Record<string, CalcRate> = {};
  for (const [key, r] of Object.entries(stored)) out[key] = { value: new D(r.value), per: r.per, label: r.label ?? key };
  return out;
}
