import { useAuthStore } from "@/features/auth/authStore";
import { mockRequest } from "./mock";

const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"}/api/v1`;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
  auth?: boolean;
}

export async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  if (process.env.EXPO_PUBLIC_USE_MOCK === "true")
    return mockRequest<T>(path, opts);
  const {
    method = "GET",
    body,
    formData,
    timeoutMs = 15_000,
    signal,
    auth = true,
  } = opts;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = useAuthStore.getState().token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch {
    if (signal?.aborted) throw new ApiError("CANCELLED", "Cancelled", 0);
    throw new ApiError(
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      "Network request failed",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  const envelope = json as {
    data?: T;
    error?: { code: string; message: string; details?: unknown };
  } | null;

  if (res.status === 401 && auth) {
    onUnauthorized?.();
    throw new ApiError(
      "UNAUTHORIZED",
      envelope?.error?.message ?? "Unauthorized",
      401,
    );
  }
  if (!res.ok || envelope?.error) {
    const e = envelope?.error;
    throw new ApiError(
      e?.code ?? "UNKNOWN",
      e?.message ?? "Request failed",
      res.status,
      e?.details,
    );
  }
  return envelope?.data as T;
}
