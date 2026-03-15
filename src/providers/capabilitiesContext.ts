// ---------------------------------------------------------------------------
// Provider: capabilitiesContext — operational truth for the agent
// ---------------------------------------------------------------------------

import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";

export const capabilitiesContext: Provider = {
  name: "flipcoin-capabilities",
  description:
    "FlipCoin agent capabilities: what actions are available, trade limits, daily budget",
  dynamic: true,
  position: 9, // load before markets/portfolio
  private: false,

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const svc = runtime.getService<FlipCoinService>("FLIPCOIN");
    if (!svc) return { text: "", data: {}, values: {} };

    const autoSign =
      svc.serverConfig?.capabilities.autoSign ?? false;
    const canTrade = svc.ping?.ok ?? false;
    const dailyRemaining = svc.policy.getDailyRemaining();
    const feeTier = svc.ping?.fees?.tier ?? "unknown";

    const lines = [
      `FlipCoin agent status:`,
      `  canTrade: ${canTrade && autoSign ? "yes (auto_sign)" : canTrade ? "yes (manual sign)" : "no"}`,
      `  maxTradeUsdc: $${runtime.getSetting("FLIPCOIN_MAX_TRADE_USDC") || "50"}`,
      `  dailyRemainingUsdc: $${dailyRemaining.toFixed(2)}`,
      `  feeTier: ${feeTier}`,
      `  supportsCreateMarket: no (Phase 2)`,
      `  supportsCLOB: no (Phase 3)`,
    ];

    return {
      text: lines.join("\n"),
      data: {
        canTrade: canTrade && autoSign,
        dailyRemaining,
      },
      values: {},
    };
  },
};
