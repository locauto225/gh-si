const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

export const API_URL = RAW_API_URL.length > 0 ? RAW_API_URL : "http://localhost:4000";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GET_RETRY = 1;

function buildApiUrl(path: string): string {
  // Absolute URL: keep as-is
  if (/^https?:\/\//i.test(path)) return path;

  const base = API_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    return new URL(normalizedPath, base).toString();
  } catch {
    // Last resort: base accidentally lacks protocol (e.g. localhost:4001)
    if (!/^https?:\/\//i.test(base)) {
      return new URL(normalizedPath, `http://${base}`).toString();
    }
    throw new Error(`Invalid API URL. base=\"${base}\" path=\"${path}\"`);
  }
}

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, opts: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retry?: number;
  retryDelayMs?: number;
};

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(err: unknown, isIdempotent: boolean): boolean {
  if (!isIdempotent) return false;

  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 429;
  }

  return true; // network / timeout / unknown runtime fetch errors
}

function withTimeoutSignal(
  externalSignal: AbortSignal | null | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timeoutId);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      cleanup();
      controller.abort();
      return { signal: controller.signal, cleanup };
    }

    externalSignal.addEventListener(
      "abort",
      () => {
        cleanup();
        controller.abort();
      },
      { once: true }
    );
  }

  controller.signal.addEventListener(
    "abort",
    () => {
      cleanup();
    },
    { once: true }
  );

  return { signal: controller.signal, cleanup };
}

export async function apiFetch<T>(
  path: string,
  init?: ApiFetchOptions
): Promise<T> {
  const url = buildApiUrl(path);
  const method = (init?.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD";
  const retries = init?.retry ?? (isIdempotent ? DEFAULT_GET_RETRY : 0);
  const retryDelayMs = init?.retryDelayMs ?? 300;
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = new Headers(init?.headers ?? undefined);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!headers.has("Content-Type") && init?.body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  let attempt = 0;
  while (true) {
    try {
      const { signal, cleanup } = withTimeoutSignal(init?.signal, timeoutMs);
      const res = await (async () => {
        try {
          return await fetch(url, {
            ...init,
            method,
            headers,
            cache: "no-store",
            credentials: init?.credentials ?? "include",
            signal,
          });
        } finally {
          cleanup();
        }
      })();

      if (!res.ok) {
        const body = (await parseJsonSafe(res)) as ApiErrorPayload | null;
        const message = body?.error?.message ?? `API error (${res.status})`;
        throw new ApiError(message, {
          status: res.status,
          code: body?.error?.code,
          details: body?.error?.details,
        });
      }

      // 204/205: no content
      if (res.status === 204 || res.status === 205) {
        return null as T;
      }

      const json = await parseJsonSafe(res);
      return json as T;
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err, isIdempotent)) {
        if (err instanceof ApiError) throw err;
        const message = (err as { message?: string })?.message || "Erreur réseau";
        throw new ApiError(message, { status: 0, code: "NETWORK_ERROR" });
      }
      await delay(retryDelayMs * Math.max(1, attempt + 1));
      attempt += 1;
    }
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}


export function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function apiPatch<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function apiPut<T>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}
