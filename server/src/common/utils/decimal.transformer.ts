import { ValueTransformer } from 'typeorm';
import { D, Dec } from './decimal';

/** Postgres numeric <-> Decimal. TypeORM hands numerics back as strings. */
export const decimalTransformer: ValueTransformer = {
  to: (v?: Dec | string | number | null) => (v === undefined || v === null ? v : String(v)),
  from: (v?: string | null) => (v === null || v === undefined ? null : new D(v)),
};
