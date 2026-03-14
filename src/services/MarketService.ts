// ---------------------------------------------------------------------------
// MarketService — market discovery, detail, portfolio
// ---------------------------------------------------------------------------

import type { ApiClient } from "./ApiClient.js";
import type {
  MarketSummary,
  MarketDetail,
  ExploreParams,
  PortfolioResponse,
  Quote,
  QuoteParams,
} from "../types/index.js";

const CACHE_TTL_MS = 60_000; // 1 min

export class MarketService {
  private exploreCache: { data: MarketSummary[]; ts: number } | null = null;

  constructor(private readonly api: ApiClient) {}

  /** Browse open markets (cached for 60s). */
  async explore(params?: ExploreParams): Promise<MarketSummary[]> {
    const isCacheable =
      !params || (!params.search && !params.offset && !params.status);

    if (
      isCacheable &&
      this.exploreCache &&
      Date.now() - this.exploreCache.ts < CACHE_TTL_MS
    ) {
      return this.exploreCache.data;
    }

    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.sort) query.sort = params.sort;
    if (params?.search) query.search = params.search;
    if (params?.limit) query.limit = String(params.limit);
    if (params?.offset) query.offset = String(params.offset);

    const res = await this.api.get<{ markets: MarketSummary[] }>(
      "/api/agent/markets/explore",
      query,
    );

    if (isCacheable) {
      this.exploreCache = { data: res.markets, ts: Date.now() };
    }

    return res.markets;
  }

  /** Get full detail for a single market. */
  async getDetail(address: string): Promise<MarketDetail> {
    const res = await this.api.get<MarketDetail>(
      `/api/agent/markets/${address}`,
    );
    return res;
  }

  /** Get a deterministic quote (public endpoint, no auth). */
  async getQuote(params: QuoteParams): Promise<Quote> {
    return this.api.getQuote<Quote>({
      conditionId: params.conditionId,
      side: params.side,
      action: params.action,
      amount: params.amount,
    });
  }

  /** Get agent's portfolio (positions + vault balance). */
  async getPortfolio(): Promise<PortfolioResponse> {
    return this.api.get<PortfolioResponse>("/api/agent/portfolio");
  }

  /** Invalidate explore cache (e.g. after creating a market). */
  invalidateCache(): void {
    this.exploreCache = null;
  }
}
