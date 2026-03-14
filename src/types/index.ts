// ---------------------------------------------------------------------------
// FlipCoin Plugin — shared types
// ---------------------------------------------------------------------------

/** Plugin configuration resolved from runtime settings. */
export interface FlipCoinConfig {
  apiKey: string;
  autoSign: boolean;
  maxTradeUsdc: number;
  maxDailyUsdc: number;
  baseUrl: string;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface MarketSummary {
  address: string;
  conditionId: string;
  question: string;
  category: string;
  status: "open" | "pending" | "resolved" | "expired";
  currentPriceYesBps: number;
  currentPriceNoBps: number;
  volumeUsdc: string;
  resolveEndAt: string | null;
  createdAt: string;
  outcome?: string | null;
}

export interface MarketDetail extends MarketSummary {
  description: string | null;
  resolutionCriteria: string | null;
  resolutionSource: string | null;
  liquidityParam: number;
  vaultBalance: string;
  stats: {
    volume24h: string;
    trades24h: number;
  };
  recentTrades: RecentTrade[];
}

export interface RecentTrade {
  side: "yes" | "no";
  isBuy: boolean;
  amountUsdc: string;
  shares: string;
  priceYesBps: number;
  timestamp: string;
}

export interface ExploreParams {
  status?: "open" | "pending" | "resolved" | "expired";
  sort?: "volume" | "created" | "trades" | "deadlineSoon";
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QuoteParams {
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: string; // bigint string, 6 decimals
}

export interface Quote {
  quoteId: string;
  venue: "lmsr" | "clob";
  validUntil: string;
  lmsr: {
    sharesOut: string;
    fee: string;
    priceImpactBps: number;
    avgPriceBps: number;
  } | null;
  clob: {
    canFillFull: boolean;
    bestBidBps: number;
    bestAskBps: number;
  } | null;
  priceImpactGuard: {
    level: "ok" | "warn" | "block";
    impactBps: number;
  };
}

export interface TradeIntentParams {
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  usdcAmount?: string;
  sharesAmount?: string;
  maxSlippageBps?: number;
}

export interface TradeIntent {
  intentId: string;
  quote: {
    sharesOut: string;
    fee: string;
    avgPriceBps: number;
    priceImpactBps: number;
  };
  balanceCheck: {
    sufficient: boolean;
    available: string;
    required: string;
  };
}

export interface TradeReceipt {
  status: "submitted" | "confirmed" | "failed" | "unknown";
  intentId: string;
  txHash?: string;
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  requestedUsdc: string;
  quotedShares: string;
  feeUsdc: string;
  priceImpactBps: number;
  message: string;
}

export interface Position {
  conditionId: string;
  marketAddress: string;
  question: string;
  status: string;
  yesShares: string;
  noShares: string;
  currentValueUsdc: string;
  pnlUsdc: string;
  avgEntryPriceUsdc: string;
}

export interface PortfolioResponse {
  vaultBalance: string;
  positions: Position[];
}

export interface PingResponse {
  ok: boolean;
  agentId: string;
  feeTier: string;
  scopes: string[];
}

export interface ConfigResponse {
  contracts: Record<string, string>;
  capabilities: {
    relay: boolean;
    autoSign: boolean;
    deposit: boolean;
  };
  tradingConstants: {
    minTradeUsdc: string;
    maxTradeUsdc: string;
  };
}

// ---------------------------------------------------------------------------
// API error
// ---------------------------------------------------------------------------

export class FlipCoinApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "FlipCoinApiError";
  }
}
