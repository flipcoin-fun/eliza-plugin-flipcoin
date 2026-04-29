// ---------------------------------------------------------------------------
// FlipCoin Plugin — shared types (aligned with OpenAPI spec 2026-03-13)
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
  id: string;
  marketAddr: string;
  conditionId: string | null;
  title: string;
  description?: string;
  category?: string | null;
  status: "open" | "paused" | "pending" | "resolved";
  currentPriceYesBps?: number;
  currentPriceNoBps?: number;
  volumeUsdc: number;
  liquidityUsdc?: number;
  tradesCount: number;
  resolveEndAt?: string | null;
  createdAt: string;
  resolvedOutcome?: boolean | null;
  imageUrl?: string | null;
  fingerprint?: string;
  creatorAddr?: string | null;
  updatedAt?: string | null;
}

/** Full market details — wrapped in { market, recentTrades, stats }. */
export interface MarketDetail extends MarketSummary {
  agentMetadata?: AgentMetadata;
  resolution?: ResolutionInfo;
  volumeBySource?: { backstop: string; clob: string; total: string };
  lastActivityAt?: string | null;
  resolveStartAt?: string | null;
  resolvedAt?: string | null;
  createdByAgentId?: string | null;
}

export interface AgentMetadata {
  reasoning?: string;
  confidence?: number;
  sources?: string[];
  modelId?: string;
  tags?: string[];
}

export interface ResolutionInfo {
  proposedOutcome: "yes" | "no" | "invalid" | null;
  proposedAt: string | null;
  finalizeAfter: string | null;
  canFinalize: boolean;
  disputeTimeRemaining: number;
  isDisputed: boolean;
}

/** Response shape from GET /api/agent/markets/{address} */
export interface MarketDetailsResponse {
  market: MarketDetail;
  recentTrades: RecentTrade[];
  stats: {
    volume24h: string;
    trades24h: number;
  };
}

export interface RecentTrade {
  trader: string;
  side: "yes" | "no";
  amountUsdc: number;
  shares: number;
  fee: number;
  priceYesBps: number;
  txHash: string;
  blockNumber: number;
  eventTime: string;
}

export interface ExploreParams {
  status?: "open" | "pending" | "resolved" | "all";
  sort?: "volume" | "created" | "trades" | "deadlineSoon";
  search?: string;
  fingerprint?: string;
  createdByAgent?: string;
  creatorAddr?: string;
  minVolume?: number;
  resolveEndBefore?: string;
  resolveEndAfter?: string;
  limit?: number;
  offset?: number;
}

export interface QuoteParams {
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: string; // number of shares as bigint string, 6 decimals
}

export interface Quote {
  quoteId: string;
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: string;
  venue: "lmsr" | "clob";
  reason: string;
  validUntil: string;
  mayPartialFill?: boolean;
  splitLegs?: {
    clob?: { shares: string; cost: string; avgPriceBps: number };
    lmsr?: { shares: string; cost: string; avgPriceBps: number };
  };
  lmsr?: {
    available: boolean;
    sharesOut: string;
    amountOut: string;
    fee: string;
    priceYesBps: number;
    priceNoBps: number;
    newPriceYesBps: number;
    priceImpactBps: number;
    avgPriceBps: number;
  } | null;
  clob?: {
    available: boolean;
    canFillFull: boolean;
    sharesOut: string;
    amountOut: string;
    avgPriceBps: number;
    levelsUsed: number;
    bestBidBps: number;
    bestAskBps: number;
    spreadBps: number;
    depthNearMid: number;
  } | null;
  priceImpactGuard?: {
    currentPriceYesBps: number;
    newPriceYesBps: number;
    impactBps: number;
    maxAllowedImpactBps: number;
    level: "ok" | "warn" | "blocked";
  };
}

export interface TradeIntentParams {
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  usdcAmount?: string;
  sharesAmount?: string;
  maxSlippageBps?: number;
  maxFeeBps?: number;
  venue?: "lmsr" | "clob" | "auto";
  // Per-trade reasoning fields (PR #2 — auto-comment after fill).
  // All optional. confidenceBps is integer in [0, 10000].
  confidenceBps?: number;
  reasoning?: string;
  dataSources?: string[];
  modelUsed?: string;
}

export interface TradeIntent {
  intentId: string;
  status: "awaiting_relay";
  venue: "lmsr" | "clob";
  quote: {
    sharesOut: string;
    fee: string;
    avgPriceBps: number;
    priceImpactBps: number;
  };
  balanceCheck?: {
    sufficient: boolean;
    available: string;
    required: string;
  };
  priceImpactGuard?: {
    currentPriceYesBps: number;
    newPriceYesBps: number;
    impactBps: number;
    maxAllowedImpactBps: number;
    level: "ok" | "warn" | "blocked";
  };
}

export interface TradeReceipt {
  status: "confirmed" | "failed";
  intentId: string;
  venue: "lmsr";
  txHash?: string;
  sharesOut?: string;
  usdcOut?: string;
  feeUsdc?: string;
  nextNonce?: string | null;
  error?: string | null;
  errorCode?: string | null;
  retryable?: boolean;
  // Enriched by plugin
  conditionId: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  requestedUsdc: string;
  quotedShares: string;
  priceImpactBps: number;
  message: string;
}

export interface Position {
  marketAddr: string;
  title: string;
  status: string;
  yesShares: number;
  noShares: number;
  netSide: "yes" | "no";
  netShares: number;
  avgEntryPriceUsdc: number;
  currentPriceBps: number;
  currentValueUsdc: number;
  pnlUsdc: number;
  lastTradeAt: string;
}

export interface PortfolioResponse {
  positions: Position[];
  totals: {
    marketsActive: number;
    marketsResolved: number;
  };
}

export interface PingResponse {
  ok: boolean;
  agent: {
    name: string;
  };
  rateLimit: {
    read: RateLimitBucket;
    write: RateLimitBucket;
    create: RateLimitBucket;
    trade: RateLimitBucket;
    autosign: RateLimitBucket;
    dailyMarkets: {
      remaining: number;
      limit: number;
      resetAt: string;
    };
  };
  fees: {
    tier: "early_adopter" | "standard";
    creatorFeeBps: number;
    protocolFeeBps: number;
    totalFeeBps: number;
    totalFeePercent: string;
    resolutionFeeBps?: number;
    creatorFeePercent?: string;
    earlyAdopter?: {
      isEarlyAdopter: boolean;
      activationRank: number | null;
      slotsTotal: number;
      slotsRemaining: number;
    };
    seedSubsidy?: {
      eligible: boolean;
      total: number;
      used: number;
      remaining: number;
    };
  };
}

export interface RateLimitBucket {
  remaining: number;
  limit: number;
  window: string;
  resetAt: string;
}

export interface ConfigResponse {
  chainId: number;
  mode: "testnet" | "mainnet";
  feeRecipientPolicy?: "owner_wallet" | "session_key";
  contracts: Record<string, string>;
  capabilities: {
    relay: boolean;
    autoSign: boolean;
    sessionKeys: boolean;
    treasury: boolean;
    deposit: boolean;
    withdraw?: boolean;
    resolution?: boolean;
  };
  limits: {
    minTradeUsdc: string;
    maxTradeUsdc: string;
    maxBatchSize?: number;
    dailyMarketCapPerAgent?: number;
    dailyMarketCapPerOwner?: number;
    dailyTradesPerAgent?: number;
    dailyTradesPerOwner?: number;
  };
  trading: {
    venues: string[];
    lmsr?: {
      quoteValiditySeconds: number;
      defaultSlippageBps: number;
      defaultMaxFeeBps: number;
    };
    clob?: {
      timeInForceOptions: string[];
      maxOrderDurationDays: number;
    };
    autoSign: {
      maxTradeUsdc: string;
      maxTxPerMinute: number;
    };
    rateLimit?: {
      sustained: string;
      burst: string;
    };
  };
  fees?: {
    lmsrTradingFeeBps: number;
    clobMakerFeeBps: number;
    clobTakerFeeBps: number;
    note?: string;
  };
  vault?: {
    minDepositUsdc?: string;
    maxDepositUsdc?: string;
    intentExpirySeconds?: number;
    withdrawIntentExpirySeconds?: number;
    withdrawAutoSignSupported?: boolean;
    autoSign?: {
      maxDepositUsdc: string;
      maxTxPerMinute: number;
    };
    minWithdrawUsdc?: string;
    maxWithdrawUsdc?: string;
    note?: string;
    withdrawNote?: string;
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
