export const RATE_TYPES = ['area', 'length', 'count'] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const UNITS = ['ft', 'm'] as const;
export type Unit = (typeof UNITS)[number];

/** decimal: 10.5 means 10.5 ft. feet_inches: digits after the dot are inches (10.8 = 10 ft 8 in). */
export const CALC_MODES = ['decimal', 'feet_inches'] as const;
export type CalcMode = (typeof CALC_MODES)[number];

export const UNKNOWN_CATEGORY = 'unknown';

export interface RateInput {
  value: string;
  per: RateType;
  label?: string;
}
export interface AuthUser {
  id: string;
  email: string | null;
}
