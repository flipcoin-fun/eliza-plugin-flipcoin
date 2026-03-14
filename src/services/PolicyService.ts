// ---------------------------------------------------------------------------
// PolicyService — hard execution gates (balance, limits, impact)
// ---------------------------------------------------------------------------

import type { FlipCoinConfig, Quote } from "../types/index.js";

/** Rolling window for daily spend tracking. */
const DAY_MS = 24 * 60 * 60 * 1_000;

interface SpendEntry {
  usdcAmount: number;
  ts: number;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PolicyService {
  private spendLog: SpendEntry[] = [];

  constructor(private readonly config: FlipCoinConfig) {}

  /**
   * Hard gate — called right before relay.
   * Returns { allowed: false, reason } if the trade should be blocked.
   */
  assertCanTrade(
    usdcAmount: number,
    quote: Quote,
    marketStatus: string,
  ): PolicyCheckResult {
    // 1. Market must be open
    if (marketStatus !== "open") {
      return { allowed: false, reason: `Market is ${marketStatus}, not open` };
    }

    // 2. Trade size limit
    if (usdcAmount > this.config.maxTradeUsdc) {
      return {
        allowed: false,
        reason: `Trade $${usdcAmount} exceeds max $${this.config.maxTradeUsdc}`,
      };
    }

    // 3. Minimum trade size ($0.01)
    if (usdcAmount < 0.01) {
      return { allowed: false, reason: "Trade below minimum $0.01" };
    }

    // 4. Daily spend limit
    const dailySpent = this.getDailySpend();
    if (dailySpent + usdcAmount > this.config.maxDailyUsdc) {
      return {
        allowed: false,
        reason: `Daily limit: spent $${dailySpent.toFixed(2)} of $${this.config.maxDailyUsdc}, trade $${usdcAmount} would exceed`,
      };
    }

    // 5. Price impact guard
    if (quote.priceImpactGuard.level === "block") {
      return {
        allowed: false,
        reason: `Price impact ${quote.priceImpactGuard.impactBps}bps exceeds hard limit`,
      };
    }

    return { allowed: true };
  }

  /** Record a successful trade for daily tracking. */
  recordSpend(usdcAmount: number): void {
    this.spendLog.push({ usdcAmount, ts: Date.now() });
    this.pruneSpendLog();
  }

  /** Get total USDC spent in the last 24 hours. */
  getDailySpend(): number {
    this.pruneSpendLog();
    return this.spendLog.reduce((sum, e) => sum + e.usdcAmount, 0);
  }

  /** Get remaining daily budget. */
  getDailyRemaining(): number {
    return Math.max(0, this.config.maxDailyUsdc - this.getDailySpend());
  }

  private pruneSpendLog(): void {
    const cutoff = Date.now() - DAY_MS;
    this.spendLog = this.spendLog.filter((e) => e.ts > cutoff);
  }
}
