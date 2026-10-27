import { request } from './client';
import type { Rate, RateOverride } from './types';

export const ratesApi = {
  list: () => request<Rate[]>('/rates'),
  save: (categoryKey: string, body: RateOverride) =>
    request<Rate>(`/rates/${categoryKey}`, { method: 'PUT', body }),
};
