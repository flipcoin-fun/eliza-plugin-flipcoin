// ---------------------------------------------------------------------------
// FlipCoinService — ElizaOS Service entry point, owns all sub-services
// ---------------------------------------------------------------------------

import type { IAgentRuntime } from "@elizaos/core";
import { Service } from "@elizaos/core";
import type { FlipCoinConfig, PingResponse, ConfigResponse } from "../types/index.js";
import { ApiClient } from "./ApiClient.js";
import { MarketService } from "./MarketService.js";
import { TradingService } from "./TradingService.js";
import { PolicyService } from "./PolicyService.js";

export class FlipCoinService extends Service {
  static serviceType = "FLIPCOIN";
  capabilityDescription =
    "Trade prediction markets on FlipCoin.fun (Base chain)";

  public api!: ApiClient;
  public markets!: MarketService;
  public trading!: TradingService;
  public policy!: PolicyService;

  // Cached on startup
  public ping: PingResponse | null = null;
  public serverConfig: ConfigResponse | null = null;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<FlipCoinService> {
    const config = resolveConfig(runtime);
    const svc = new FlipCoinService(runtime);

    svc.api = new ApiClient(config);
    svc.markets = new MarketService(svc.api);
    svc.trading = new TradingService(svc.api, config);
    svc.policy = new PolicyService(config);

    // Verify API key on startup
    try {
      svc.ping = await svc.api.get<PingResponse>("/api/agent/ping");
      svc.serverConfig = await svc.api.get<ConfigResponse>(
        "/api/agent/config",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`FlipCoin plugin startup failed: ${msg}`);
    }

    return svc;
  }

  async stop(): Promise<void> {
    // nothing to clean up
  }
}

// ---------------------------------------------------------------------------
// Config resolver
// ---------------------------------------------------------------------------

function resolveConfig(runtime: IAgentRuntime): FlipCoinConfig {
  const apiKey = runtime.getSetting("FLIPCOIN_API_KEY");
  if (!apiKey) {
    throw new Error("FLIPCOIN_API_KEY is required");
  }

  return {
    apiKey: String(apiKey),
    autoSign: runtime.getSetting("FLIPCOIN_AUTO_SIGN") === "true",
    maxTradeUsdc: Number(runtime.getSetting("FLIPCOIN_MAX_TRADE_USDC")) || 50,
    maxDailyUsdc: Number(runtime.getSetting("FLIPCOIN_MAX_DAILY_USDC")) || 200,
    baseUrl:
      String(runtime.getSetting("FLIPCOIN_BASE_URL") || "https://flipcoin.fun"),
  };
}
