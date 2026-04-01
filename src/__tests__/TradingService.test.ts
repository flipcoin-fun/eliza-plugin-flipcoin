import { describe, it, expect, vi, beforeEach } from "vitest";
import { TradingService } from "../services/TradingService.js";
import type { FlipCoinConfig } from "../types/index.js";

const mockConfig: FlipCoinConfig = {
  apiKey: "fc_agent_live_test",
  autoSign: true,
  maxTradeUsdc: 50,
  maxDailyUsdc: 200,
  baseUrl: "https://flipcoin.fun",
};

const mockIntentResponse = {
  intentId: "intent-123",
  quote: {
    sharesOut: "10000000",
    fee: "50000",
    avgPriceBps: 5200,
    priceImpactBps: 150,
  },
  balanceCheck: { sufficient: true, available: "100000000", required: "5050000" },
};

const mockRelayResponse = {
  txHash: "0xabc123",
  sharesOut: "10000000",
  feeUsdc: "50000",
};

describe("TradingService", () => {
  let trading: TradingService;
  let mockApi: { post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApi = {
      post: vi.fn(),
    };
    trading = new TradingService(mockApi as never, mockConfig);
  });

  it("executes full trade pipeline: intent → relay", async () => {
    mockApi.post
      .mockResolvedValueOnce(mockIntentResponse)
      .mockResolvedValueOnce(mockRelayResponse);

    const receipt = await trading.executeTrade({
      conditionId: "0x" + "a".repeat(64),
      side: "yes",
      action: "buy",
      usdcAmount: "5000000",
    });

    expect(receipt.status).toBe("confirmed");
    expect(receipt.txHash).toBe("0xabc123");
    expect(receipt.intentId).toBe("intent-123");
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });

  it("deduplicates identical trades within the same time bucket", async () => {
    mockApi.post
      .mockResolvedValueOnce(mockIntentResponse)
      .mockResolvedValueOnce(mockRelayResponse);

    const params = {
      conditionId: "0x" + "b".repeat(64),
      side: "yes" as const,
      action: "buy" as const,
      usdcAmount: "5000000",
    };

    const r1 = await trading.executeTrade(params);
    const r2 = await trading.executeTrade(params);

    expect(r1).toEqual(r2);
    // Only one set of API calls (intent + relay)
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });

  it("returns failed status when auto_sign is disabled", async () => {
    const noAutoSign = new TradingService(mockApi as never, {
      ...mockConfig,
      autoSign: false,
    });

    mockApi.post.mockResolvedValueOnce(mockIntentResponse);

    const receipt = await noAutoSign.executeTrade({
      conditionId: "0x" + "c".repeat(64),
      side: "no",
      action: "buy",
      usdcAmount: "1000000",
    });

    expect(receipt.status).toBe("failed");
    expect(receipt.message).toContain("auto_sign is disabled");
    // Only intent call, no relay
    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });

  it("returns failed receipt on relay error", async () => {
    mockApi.post
      .mockResolvedValueOnce(mockIntentResponse)
      .mockRejectedValueOnce(new Error("relay timeout"));

    const receipt = await trading.executeTrade({
      conditionId: "0x" + "d".repeat(64),
      side: "yes",
      action: "sell",
      usdcAmount: "3000000",
    });

    expect(receipt.status).toBe("failed");
    expect(receipt.message).toContain("relay timeout");
  });
});
