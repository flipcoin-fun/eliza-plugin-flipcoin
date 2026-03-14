// ---------------------------------------------------------------------------
// @flipcoin/plugin-elizaos — ElizaOS plugin for FlipCoin prediction markets
// ---------------------------------------------------------------------------
// Phase 1: read markets + simple LMSR trading
// Phase 2: market creation, feed, webhooks
// Phase 3: CLOB orders, autonomous strategies
// ---------------------------------------------------------------------------

import type { Plugin } from "@elizaos/core";
import { FlipCoinService } from "./services/FlipCoinService.js";
import {
  listMarkets,
  getMarket,
  getQuote,
  buyYes,
  buyNo,
  sellYes,
  sellNo,
} from "./actions/index.js";
import {
  marketContext,
  portfolioContext,
  capabilitiesContext,
} from "./providers/index.js";
import { shouldTrade } from "./evaluators/index.js";

export const flipcoinPlugin: Plugin = {
  name: "flipcoin",
  description:
    "Trade prediction markets on FlipCoin.fun (Base). Browse markets, get quotes, buy/sell YES and NO shares via LMSR AMM.",

  services: [FlipCoinService],
  actions: [listMarkets, getMarket, getQuote, buyYes, buyNo, sellYes, sellNo],
  providers: [marketContext, portfolioContext, capabilitiesContext],
  evaluators: [shouldTrade],
};

export default flipcoinPlugin;

// Re-export types for consumers
export type {
  FlipCoinConfig,
  MarketSummary,
  MarketDetail,
  Quote,
  TradeReceipt,
  Position,
  PortfolioResponse,
  PingResponse,
  ConfigResponse,
  FlipCoinApiError,
} from "./types/index.js";
export { FlipCoinService } from "./services/FlipCoinService.js";
