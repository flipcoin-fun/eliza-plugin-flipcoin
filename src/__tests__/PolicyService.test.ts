import { describe, it, expect, beforeEach } from "vitest";
import { PolicyService } from "../services/PolicyService.js";
import type { FlipCoinConfig, Quote } from "../types/index.js";

function makeConfig(overrides?: Partial<FlipCoinConfig>): FlipCoinConfig {
  return {
    apiKey: "fc_agent_live_test",
    autoSign: true,
    maxTradeUsdc: 50,
    maxDailyUsdc: 200,
    baseUrl: "https://flipcoin.fun",
    ...overrides,
  };
}

function makeQuote(overrides?: Partial<Quote>): Quote {
  return {
    quoteId: "q1",
    venue: "lmsr",
    validUntil: new Date(Date.now() + 15_000).toISOString(),
    lmsr: {
      sharesOut: "10000000",
      fee: "50000",
      priceImpactBps: 200,
      avgPriceBps: 5200,
    },
    clob: null,
    priceImpactGuard: { level: "ok", impactBps: 200 },
    ...overrides,
  };
}

describe("PolicyService", () => {
  let policy: PolicyService;

  beforeEach(() => {
    policy = new PolicyService(makeConfig());
  });

  describe("assertCanTrade", () => {
    it("allows a normal trade", () => {
      const result = policy.assertCanTrade(10, makeQuote(), "open");
      expect(result.allowed).toBe(true);
    });

    it("blocks trade on non-open market", () => {
      const result = policy.assertCanTrade(10, makeQuote(), "resolved");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("resolved");
    });

    it("blocks trade exceeding max size", () => {
      const result = policy.assertCanTrade(100, makeQuote(), "open");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds max");
    });

    it("blocks trade below minimum", () => {
      const result = policy.assertCanTrade(0.005, makeQuote(), "open");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("minimum");
    });

    it("blocks trade when daily limit exceeded", () => {
      // Spend up to the limit
      policy.recordSpend(195);
      const result = policy.assertCanTrade(10, makeQuote(), "open");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily limit");
    });

    it("blocks trade when price impact is blocked", () => {
      const quote = makeQuote({
        priceImpactGuard: { level: "blocked", impactBps: 3500 },
      });
      const result = policy.assertCanTrade(10, quote, "open");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Price impact");
    });

    it("allows trade with warn-level price impact", () => {
      const quote = makeQuote({
        priceImpactGuard: { level: "warn", impactBps: 1800 },
      });
      const result = policy.assertCanTrade(10, quote, "open");
      expect(result.allowed).toBe(true);
    });
  });

  describe("daily spend tracking", () => {
    it("tracks cumulative spend", () => {
      policy.recordSpend(50);
      policy.recordSpend(30);
      expect(policy.getDailySpend()).toBe(80);
      expect(policy.getDailyRemaining()).toBe(120);
    });

    it("starts at zero", () => {
      expect(policy.getDailySpend()).toBe(0);
      expect(policy.getDailyRemaining()).toBe(200);
    });
  });
});
