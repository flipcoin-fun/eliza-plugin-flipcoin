// ---------------------------------------------------------------------------
// TradingService — quote → intent → relay → receipt
// ---------------------------------------------------------------------------

import type { ApiClient } from "./ApiClient.js";
import type {
  FlipCoinConfig,
  TradeIntentParams,
  TradeIntent,
  TradeReceipt,
} from "../types/index.js";

/** TTL for the execution journal (dedup window). */
const JOURNAL_TTL_MS = 60_000;

interface JournalEntry {
  receipt: TradeReceipt;
  ts: number;
}

export class TradingService {
  private journal = new Map<string, JournalEntry>();

  constructor(
    private readonly api: ApiClient,
    private readonly config: FlipCoinConfig,
  ) {}

  /**
   * Full trade pipeline: intent → relay → receipt.
   * Idempotent within a 60s dedup window based on deterministic requestId.
   */
  async executeTrade(
    params: TradeIntentParams & { action: "buy" | "sell" },
  ): Promise<TradeReceipt> {
    const requestId = this.buildRequestId(params);
    const cached = this.getFromJournal(requestId);
    if (cached) return cached;

    // Step 1: Create intent
    const intent = await this.createIntent(params);

    // Step 2: Relay
    const receipt = await this.relay(intent.intentId, params, intent);

    // Step 3: Journal
    this.addToJournal(requestId, receipt);
    return receipt;
  }

  /** Create a trade intent (returns preview + typed data). */
  async createIntent(params: TradeIntentParams): Promise<TradeIntent> {
    return this.api.post<TradeIntent>("/api/agent/trade/intent", {
      conditionId: params.conditionId,
      side: params.side,
      action: params.action,
      usdcAmount: params.usdcAmount,
      sharesAmount: params.sharesAmount,
      maxSlippageBps: params.maxSlippageBps,
      maxFeeBps: params.maxFeeBps,
      venue: params.venue,
      // Per-trade reasoning (PR #2). Forwarded as-is so the API auto-comments
      // after a fill. All optional — backend accepts both camel/snake_case.
      confidenceBps: params.confidenceBps,
      reasoning: params.reasoning,
      dataSources: params.dataSources,
      modelUsed: params.modelUsed,
    });
  }

  /** Relay a signed intent (auto_sign mode). */
  private async relay(
    intentId: string,
    params: TradeIntentParams & { action: "buy" | "sell" },
    intent: TradeIntent,
  ): Promise<TradeReceipt> {
    const base = {
      intentId,
      venue: intent.venue as "lmsr",
      conditionId: params.conditionId,
      side: params.side,
      action: params.action,
      requestedUsdc: params.usdcAmount ?? "0",
      quotedShares: intent.quote.sharesOut,
      feeUsdc: intent.quote.fee,
      priceImpactBps: intent.quote.priceImpactBps,
    };

    if (!this.config.autoSign) {
      return {
        ...base,
        status: "failed" as const,
        message:
          "auto_sign is disabled. Use the intent's typedData to sign externally.",
      };
    }

    try {
      const res = await this.api.post<{
        txHash: string;
        sharesOut?: string;
        feeUsdc?: string;
      }>("/api/agent/trade/relay", {
        intentId,
        auto_sign: true,
      });

      return {
        ...base,
        status: "confirmed" as const,
        txHash: res.txHash,
        quotedShares: res.sharesOut ?? base.quotedShares,
        feeUsdc: res.feeUsdc ?? base.feeUsdc,
        message: `Trade confirmed. tx: ${res.txHash}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        status: "failed" as const,
        message: `Trade relay failed: ${msg}`,
      };
    }
  }

  // ---- idempotency journal ------------------------------------------------

  /**
   * Deterministic request ID based on trade params + 10-second time bucket.
   * Prevents duplicate trades from agent retries within the same window.
   */
  private buildRequestId(params: TradeIntentParams): string {
    const bucket = Math.floor(Date.now() / 10_000);
    return `${params.conditionId}:${params.side}:${params.action}:${params.usdcAmount ?? params.sharesAmount}:${bucket}`;
  }

  private getFromJournal(requestId: string): TradeReceipt | null {
    this.pruneJournal();
    const entry = this.journal.get(requestId);
    return entry ? entry.receipt : null;
  }

  private addToJournal(requestId: string, receipt: TradeReceipt): void {
    this.journal.set(requestId, { receipt, ts: Date.now() });
  }

  private pruneJournal(): void {
    const now = Date.now();
    for (const [key, entry] of this.journal) {
      if (now - entry.ts > JOURNAL_TTL_MS) this.journal.delete(key);
    }
  }
}
