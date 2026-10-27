export type Unit = "ft" | "m";
export type RateType = "area" | "length" | "count";

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
  unit: Unit;
}

export interface ExtractResponse {
  id: string;
  items: EstimateItem[];
}

export interface RateOverride {
  value: string;
  per: RateType;
  label?: string;
}
export interface CalculateRequest {
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
  amount: string;
}
export interface ResultGroupData {
  categoryKey: string;
  label: string;
  labelNe: string;
  rate: { value: string; per: RateType };
  items: ResultItem[];
  subtotal: string;
}
export interface CalculateResponse {
  groups: ResultGroupData[];
  invalid: { id: string; reason: string }[];
  grandTotal: string;
  currency: "NPR";
}
