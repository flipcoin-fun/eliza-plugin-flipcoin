import { describe, it, expect, vi } from "vitest";
import { MarketService } from "../services/MarketService.js";

describe("MarketService.explore", () => {
  it("forwards all advanced filters to /api/agent/markets/explore", async () => {
    const get = vi.fn().mockResolvedValue({ markets: [] });
    const svc = new MarketService({ get } as never);

    await svc.explore({
      status: "open",
      sort: "volume",
      search: "AI",
      fingerprint: "fp-1",
      createdByAgent: "agent-1",
      creatorAddr: "0xabc",
      minVolume: 1000,
      resolveEndBefore: "2026-12-31",
      resolveEndAfter: "2026-01-01",
      limit: 25,
      offset: 0,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/agent/markets/explore",
      expect.objectContaining({
        status: "open",
        sort: "volume",
        search: "AI",
        fingerprint: "fp-1",
        createdByAgent: "agent-1",
        creatorAddr: "0xabc",
        minVolume: "1000",
        resolveEndBefore: "2026-12-31",
        resolveEndAfter: "2026-01-01",
        limit: "25",
      }),
    );
  });

  it("bypasses cache when an advanced filter is set", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ markets: [{ id: "a" }] })
      .mockResolvedValueOnce({ markets: [{ id: "b" }] });
    const svc = new MarketService({ get } as never);

    const r1 = await svc.explore({ creatorAddr: "0x1" });
    const r2 = await svc.explore({ creatorAddr: "0x1" });

    expect(get).toHaveBeenCalledTimes(2);
    expect(r1[0]?.id).toBe("a");
    expect(r2[0]?.id).toBe("b");
  });
});
