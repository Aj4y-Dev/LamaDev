import { request } from "./client";
import type { Rate, RateOverride } from "./types";

export const ratesApi = {
  list: (projectId: string) => request<Rate[]>(`/projects/${projectId}/rates`),
  save: (projectId: string, categoryKey: string, body: RateOverride) =>
    request<Rate>(`/projects/${projectId}/rates/${categoryKey}`, {
      method: "PUT",
      body,
    }),
};
