export type Unit = "ft" | "m";
export type RateType = "area" | "length" | "count";
/** decimal: 10.5 means 10.5 ft. feet_inches: the digits after the dot are inches (10.8 = 10 ft 8 in). */
export type CalcMode = "decimal" | "feet_inches";

export interface User {
  id: string;
  email: string;
}
export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  title: string;
  clientName?: string | null;
}
export interface CreateProjectInput {
  title: string;
  clientName?: string;
}

export interface EstimateItem {
  id?: string;
  categoryKey: string;
  label: string;
  length: string;
  breadth?: string | null;
  count?: number | null;
  uncertain?: boolean;
  expr?: string | null;
  written?: string | null;
  unit: Unit;
}

export interface ExtractResponse {
  id: string;
  skippedLines?: number;
  items: EstimateItem[];
}

export interface RateOverride {
  value: string;
  per: RateType;
  label?: string;
}
export interface CalculateRequest {
  mode?: CalcMode;
  rates?: Record<string, RateOverride>;
}

export interface Rate {
  categoryKey: string;
  label: string;
  labelNe: string;
  value: string;
  per: RateType;
}

export interface ResultItem {
  id: string;
  label: string;
  qty: string;
  unit: string;
  size?: string;
  amount: string;
  check?: boolean;
}
export interface ResultGroupData {
  categoryKey: string;
  label: string;
  labelNe: string;
  rate: { value: string; per: RateType };
  totalQty?: string;
  unit?: string;
  items: ResultItem[];
  subtotal: string;
}
export interface CalculateResponse {
  groups: ResultGroupData[];
  invalid: { id: string; reason: string }[];
  grandTotal: string;
  currency: "NPR";
  warnings?: {
    id: string;
    reason: string;
    written?: string;
    computed?: string;
  }[];
}
