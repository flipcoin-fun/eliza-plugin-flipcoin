// ---------------------------------------------------------------------------
// FlipCoin API Client — low-level HTTP layer
// ---------------------------------------------------------------------------

import type { FlipCoinConfig } from "../types/index.js";
import { FlipCoinApiError } from "../types/index.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [1_000, 3_000];

export class ApiClient {
  constructor(private readonly config: FlipCoinConfig) {}

  // ---- public helpers -----------------------------------------------------

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  // ---- quote endpoint (public, no auth) -----------------------------------

  async getQuote<T>(params: Record<string, string>): Promise<T> {
    const url = this.buildUrl("/api/quote", params);
    return this.request<T>(url, { method: "GET" }, false);
  }

  // ---- internals ----------------------------------------------------------

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const url = new URL(path, base);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    authenticated = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    if (authenticated) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          DEFAULT_TIMEOUT_MS,
        );

        const res = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          return (await res.json()) as T;
        }

        const body = await res.text().catch(() => "");
        let parsed: { error?: string; code?: string } = {};
        try {
          parsed = JSON.parse(body);
        } catch {
          /* not JSON */
        }

        const retryable = res.status === 429 || res.status >= 500;
        const error = new FlipCoinApiError(
          parsed.error || `HTTP ${res.status}: ${body.slice(0, 200)}`,
          res.status,
          parsed.code,
          retryable,
        );

        if (!retryable || attempt === MAX_RETRIES) throw error;
        lastError = error;
      } catch (err) {
        if (err instanceof FlipCoinApiError && !err.retryable) throw err;
        lastError = err as Error;
        if (attempt === MAX_RETRIES) break;
      }

      await sleep(RETRY_BACKOFF_MS[attempt] ?? 3_000);
    }

    throw lastError ?? new Error("Request failed after retries");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
