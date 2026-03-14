import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../services/ApiClient.js";
import { FlipCoinApiError } from "../types/index.js";
import type { FlipCoinConfig } from "../types/index.js";

const config: FlipCoinConfig = {
  apiKey: "fc_agent_live_test123",
  autoSign: false,
  maxTradeUsdc: 50,
  maxDailyUsdc: 200,
  baseUrl: "https://flipcoin.fun",
};

describe("ApiClient", () => {
  let client: ApiClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new ApiClient(config);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends auth header on authenticated requests", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await client.get("/api/agent/ping");

    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers.Authorization).toBe(
      "Bearer fc_agent_live_test123",
    );
  });

  it("does not send auth header on quote requests", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quoteId: "q1" }),
    });

    await client.getQuote({ conditionId: "0x1", side: "yes", action: "buy", amount: "1000000" });

    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers.Authorization).toBeUndefined();
  });

  it("throws FlipCoinApiError on 4xx", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "forbidden", code: "FORBIDDEN" }),
    });

    await expect(client.get("/api/agent/ping")).rejects.toThrow(
      FlipCoinApiError,
    );
  });

  it("retries on 429 and 5xx", async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    const result = await client.get<{ ok: boolean }>("/api/agent/ping");
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("builds URL with query params", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ markets: [] }),
    });

    await client.get("/api/agent/markets/explore", {
      status: "open",
      limit: "10",
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("status=open");
    expect(url).toContain("limit=10");
  });
});
