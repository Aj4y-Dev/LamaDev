import { request } from "./client";
import type {
  CalculateRequest,
  CalculateResponse,
  EstimateItem,
  ExtractResponse,
} from "./types";

export const estimatesApi = {
  extract: (projectId: string, form: FormData, signal?: AbortSignal) =>
    request<ExtractResponse>(`/projects/${projectId}/estimates/extract`, {
      method: "POST",
      formData: form,
      timeoutMs: 60_000,
      signal,
    }),
  putItems: (id: string, items: EstimateItem[]) =>
    request<unknown>(`/estimates/${id}/items`, {
      method: "PUT",
      body: { items },
    }),
  calculate: (id: string, body: CalculateRequest) =>
    request<CalculateResponse>(`/estimates/${id}/calculate`, {
      method: "POST",
      body,
    }),
  confirm: (id: string) =>
    request<unknown>(`/estimates/${id}/confirm`, { method: "POST" }),
};
