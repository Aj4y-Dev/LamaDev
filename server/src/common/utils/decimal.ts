import Decimal from 'decimal.js';

/** Isolated Decimal class: 40 digits, ROUND_HALF_UP. Never use floats for money or sizes. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
