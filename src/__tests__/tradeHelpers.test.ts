import { describe, it, expect, vi } from "vitest";
import {
  executeTradePipeline,
  parseTradeMessage,
} from "../actions/tradeHelpers.js";

describe("parseTradeMessage", () => {
  const validConditionId = "0x" + "a".repeat(64);

  it("parses a valid message with conditionId and amount", () => {
    const result = parseTradeMessage(
      `Buy $5 YES on ${validConditionId}`,
    );
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.conditionId).toBe(validConditionId);
    expect(result.usdcAmount).toBe(5);
    expect(result.usdcRaw).toBe("5000000");
  });

  it("parses amount without dollar sign", () => {
    const result = parseTradeMessage(
      `Buy 10 YES on ${validConditionId}`,
    );
    if (typeof result === "string") return;
    expect(result.usdcAmount).toBe(10);
  });

  it("parses decimal amounts", () => {
    const result = parseTradeMessage(
      `Buy $2.50 YES on ${validConditionId}`,
    );
    if (typeof result === "string") return;
    expect(result.usdcAmount).toBe(2.5);
    expect(result.usdcRaw).toBe("2500000");
  });

  it("returns error when no conditionId", () => {
    const result = parseTradeMessage("Buy $5 YES");
    expect(typeof result).toBe("string");
    expect(result).toContain("condition ID");
  });

  it("returns helpful hint when market address (40 hex) is provided instead of conditionId", () => {
    const address = "0x" + "b".repeat(40);
    const result = parseTradeMessage(`Buy $5 YES on ${address}`);
    expect(typeof result).toBe("string");
    expect(result).toContain("market address");
    expect(result).toContain("GET_MARKET");
  });

  it("returns error when no amount", () => {
    const result = parseTradeMessage(
      `Buy YES on ${validConditionId}`,
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("positive");
  });

  it("returns error for zero amount", () => {
    // Explicit zero
    const result = parseTradeMessage(
      `Buy $0 YES on ${validConditionId}`,
    );
    if (typeof result === "string") {
      expect(result).toContain("positive");
    }
    // 0 is caught by <= 0 check
  });

  it("returns amountType: usdc by default (buy action implicit)", () => {
    const result = parseTradeMessage(`Buy $5 YES on ${validConditionId}`);
    if (typeof result === "string") return;
    expect(result.amountType).toBe("usdc");
    expect(result.sharesAmount).toBeUndefined();
    expect(result.sharesRaw).toBeUndefined();
  });

  // ---- sell parsing -------------------------------------------------------

  describe("sell action — shares-denominated", () => {
    it("parses a shares-denominated sell", () => {
      const result = parseTradeMessage(
        `Sell 10 shares YES on ${validConditionId}`,
        "sell",
      );
      expect(typeof result).not.toBe("string");
      if (typeof result === "string") return;

      expect(result.conditionId).toBe(validConditionId);
      expect(result.amountType).toBe("shares");
      expect(result.sharesAmount).toBe(10);
      // 6-decimal raw, matching USDC scale used by ShareToken ERC-1155.
      expect(result.sharesRaw).toBe("10000000");
      expect(result.usdcAmount).toBeUndefined();
      expect(result.usdcRaw).toBeUndefined();
    });

    it("parses singular 'share'", () => {
      const result = parseTradeMessage(
        `Sell 1 share YES on ${validConditionId}`,
        "sell",
      );
      if (typeof result === "string") return;
      expect(result.amountType).toBe("shares");
      expect(result.sharesAmount).toBe(1);
      expect(result.sharesRaw).toBe("1000000");
    });

    it("parses fractional shares", () => {
      const result = parseTradeMessage(
        `Sell 2.5 shares NO on ${validConditionId}`,
        "sell",
      );
      if (typeof result === "string") return;
      expect(result.amountType).toBe("shares");
      expect(result.sharesAmount).toBe(2.5);
      expect(result.sharesRaw).toBe("2500000");
    });

    it("rejects sell with USDC amount (no 'shares' keyword) with helpful hint", () => {
      // This is the exact bug we're regressing against — the Agent API
      // rejects USDC-denominated sells with 400. The parser must catch
      // it before any HTTP call.
      const result = parseTradeMessage(
        `Sell $5 YES on ${validConditionId}`,
        "sell",
      );
      expect(typeof result).toBe("string");
      expect(result).toContain("shares amount");
    });

    it("rejects bare-number sell (must specify 'shares' keyword)", () => {
      const result = parseTradeMessage(
        `Sell 5 YES on ${validConditionId}`,
        "sell",
      );
      expect(typeof result).toBe("string");
      expect(result).toContain("shares amount");
    });

    it("rejects zero shares", () => {
      const result = parseTradeMessage(
        `Sell 0 shares YES on ${validConditionId}`,
        "sell",
      );
      expect(typeof result).toBe("string");
      expect(result).toContain("positive");
    });

    it("rejects sell without conditionId", () => {
      const result = parseTradeMessage(`Sell 10 shares YES`, "sell");
      expect(typeof result).toBe("string");
      expect(result).toContain("condition ID");
    });
  });
});

// ---------------------------------------------------------------------------
// Pipeline regression — proves that sell trades forward sharesAmount, not
// usdcAmount, to the API. The Agent API rejects USDC-denominated sells with
// HTTP 400; sending the wrong field is the original bug this test guards.
// ---------------------------------------------------------------------------

function makePipelineHarness(opts?: {
  quoteAmountOut?: string;
  receiptStatus?: "confirmed" | "failed";
}) {
  const quote = {
    quoteId: "q1",
    venue: "lmsr" as const,
    validUntil: new Date(Date.now() + 30_000).toISOString(),
    lmsr: {
      sharesOut: "10000000",
      fee: "50000",
      avgPriceBps: 5000,
      priceImpactBps: 100,
      // amountOut: USDC the seller will receive (raw 6-decimal).
      amountOut: opts?.quoteAmountOut ?? "5000000",
    },
    clob: null,
    priceImpactGuard: { level: "ok" as const, impactBps: 100 },
  };

  const receipt = {
    status: opts?.receiptStatus ?? "confirmed",
    intentId: "intent-1",
    venue: "lmsr",
    txHash: "0xabc",
    quotedShares: "10000000",
    feeUsdc: "50000",
    usdcOut: opts?.quoteAmountOut ?? "5000000",
    priceImpactBps: 100,
    conditionId: "0x" + "a".repeat(64),
    side: "yes",
    action: "sell",
    requestedUsdc: "0",
    message: "ok",
  };

  const trading = { executeTrade: vi.fn().mockResolvedValue(receipt) };
  const markets = { getQuote: vi.fn().mockResolvedValue(quote) };
  const policy = {
    assertCanTrade: vi.fn().mockReturnValue({ allowed: true }),
    recordSpend: vi.fn(),
  };

  const runtime = {
    getService: vi.fn(() => ({ trading, markets, policy })),
  } as never;

  return { runtime, trading, markets, policy };
}

function makeMessage(text: string) {
  return { content: { text } } as never;
}

describe("executeTradePipeline — sell flow", () => {
  const conditionId = "0x" + "a".repeat(64);

  it("sends sharesAmount (not usdcAmount) to the API on sell", async () => {
    const harness = makePipelineHarness();

    const result = await executeTradePipeline(
      harness.runtime,
      makeMessage(`Sell 10 shares YES on ${conditionId}`),
      "yes",
      "sell",
    );

    expect(result.success).toBe(true);

    // Quote was asked for the shares amount in raw units.
    expect(harness.markets.getQuote).toHaveBeenCalledWith({
      conditionId,
      side: "yes",
      action: "sell",
      amount: "10000000",
    });

    // executeTrade got sharesAmount, NOT usdcAmount.
    const call = harness.trading.executeTrade.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      conditionId,
      side: "yes",
      action: "sell",
      sharesAmount: "10000000",
    });
    expect(call.usdcAmount).toBeUndefined();
  });

  it("uses quote.lmsr.amountOut as the policy notional for sells", async () => {
    const harness = makePipelineHarness({ quoteAmountOut: "4900000" }); // $4.90

    await executeTradePipeline(
      harness.runtime,
      makeMessage(`Sell 10 shares YES on ${conditionId}`),
      "yes",
      "sell",
    );

    // Policy.assertCanTrade(notionalUsdc, quote, marketStatus). $4.90 → 4.9.
    const [notional] = harness.policy.assertCanTrade.mock.calls[0] ?? [];
    expect(notional).toBeCloseTo(4.9, 5);
  });

  it("does NOT count sells against the daily spend budget", async () => {
    const harness = makePipelineHarness({ quoteAmountOut: "4900000" });

    await executeTradePipeline(
      harness.runtime,
      makeMessage(`Sell 10 shares YES on ${conditionId}`),
      "yes",
      "sell",
    );

    // Sells release capital, not consume it — recordSpend must stay at 0 calls.
    expect(harness.policy.recordSpend).not.toHaveBeenCalled();
  });

  it("returns the parser error verbatim on USDC-denominated sell", async () => {
    const harness = makePipelineHarness();

    const result = await executeTradePipeline(
      harness.runtime,
      makeMessage(`Sell $5 YES on ${conditionId}`),
      "yes",
      "sell",
    );

    expect(result.success).toBe(false);
    expect(result.text).toContain("shares amount");
    // No HTTP calls leaked through.
    expect(harness.markets.getQuote).not.toHaveBeenCalled();
    expect(harness.trading.executeTrade).not.toHaveBeenCalled();
  });
});

describe("executeTradePipeline — buy flow (regression guard)", () => {
  const conditionId = "0x" + "b".repeat(64);

  it("still sends usdcAmount on buy and records spend", async () => {
    const harness = makePipelineHarness();

    const result = await executeTradePipeline(
      harness.runtime,
      makeMessage(`Buy $5 YES on ${conditionId}`),
      "yes",
      "buy",
    );

    expect(result.success).toBe(true);

    // executeTrade got usdcAmount, NOT sharesAmount.
    const call = harness.trading.executeTrade.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      conditionId,
      side: "yes",
      action: "buy",
      usdcAmount: "5000000",
    });
    expect(call.sharesAmount).toBeUndefined();

    // Buys still register against the daily budget.
    expect(harness.policy.recordSpend).toHaveBeenCalledWith(5);
  });
});
