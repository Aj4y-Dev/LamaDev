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

interface RawResponse {
  status: number;
  text: string;
}

/** JSON requests use fetch. */
async function fetchRaw(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<RawResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    console.warn("[api] request failed", init.method, url, String(err));
    if (signal?.aborted) throw new ApiError("CANCELLED", "Cancelled", 0);
    throw new ApiError(
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      "Network request failed",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Photo uploads use XMLHttpRequest, which sends { uri, name, type } files reliably on Android. */
function xhrPost(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = timeoutMs;
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => {
      console.warn("[api] upload failed", url, "status", xhr.status);
      reject(new ApiError("NETWORK_ERROR", "Network request failed", 0));
    };
    xhr.ontimeout = () =>
      reject(new ApiError("TIMEOUT", "Upload timed out", 0));
    xhr.onabort = () => reject(new ApiError("CANCELLED", "Cancelled", 0));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
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

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = useAuthStore.getState().token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const url = `${BASE_URL}${path}`;
  const raw = formData
    ? await xhrPost(url, formData, headers, timeoutMs, signal)
    : await fetchRaw(
        url,
        {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        timeoutMs,
        signal,
      );

  let json: unknown = null;
  try {
    json = JSON.parse(raw.text);
  } catch {
    /* empty or non-JSON body */
  }
  const envelope = json as {
    data?: T;
    error?: { code: string; message: string; details?: unknown };
  } | null;

  if (raw.status === 401 && auth) {
    onUnauthorized?.();
    throw new ApiError(
      "UNAUTHORIZED",
      envelope?.error?.message ?? "Unauthorized",
      401,
    );
  }
  if (raw.status < 200 || raw.status >= 300 || envelope?.error) {
    const e = envelope?.error;
    throw new ApiError(
      e?.code ?? "UNKNOWN",
      e?.message ?? "Request failed",
      raw.status,
      e?.details,
    );
  }
  return envelope?.data as T;
}
