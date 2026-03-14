import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import { executeTradePipeline } from "./tradeHelpers.js";

export const buyYes: Action = {
  name: "BUY_YES",
  description:
    "Buy YES shares on a FlipCoin prediction market. Requires condition ID and USDC amount.",
  similes: ["BET_YES", "LONG_YES", "GO_YES"],

  examples: [
    [
      { name: "User", content: { text: "Buy $5 YES on 0xabc...def (64 chars)" } },
      { name: "Agent", content: { text: "Bought $5 of YES. Shares: 7.2, Fee: $0.05" } },
    ],
  ],

  validate: async (runtime: IAgentRuntime) =>
    !!runtime.getService<FlipCoinService>("FLIPCOIN"),

  handler: async (runtime: IAgentRuntime, message: Memory, _state?: State) =>
    executeTradePipeline(runtime, message, "yes", "buy"),
};
