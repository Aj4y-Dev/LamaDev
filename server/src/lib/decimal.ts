import Decimal from 'decimal.js';

/** Isolated Decimal class: 40 digits, ROUND_HALF_UP. Never use floats for money or sizes. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;

/**
 * An exact fraction n/d. Sizes are kept this way so we never divide early:
 * 10 ft 8 in is 128/12, not the repeating decimal 10.6666... Dividing once at the very end keeps rounding exact.
 */
export interface Ratio {
  n: Dec;
  d: Dec;
}
