import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import { executeTradePipeline } from "./tradeHelpers.js";

export const sellYes: Action = {
  name: "SELL_YES",
  description:
    "Sell YES shares on a FlipCoin prediction market. Requires condition ID and a shares amount (e.g. \"10 shares\"). The Agent API rejects USDC-denominated sells.",
  similes: ["EXIT_YES", "CLOSE_YES"],

  examples: [
    [
      { name: "User", content: { text: "Sell 10 shares YES on 0xabc...def" } },
      { name: "Agent", content: { text: "Sold 10 shares of YES. Received: $4.90" } },
    ],
  ],

  validate: async (runtime: IAgentRuntime) =>
    !!runtime.getService<FlipCoinService>("FLIPCOIN"),

  handler: async (runtime: IAgentRuntime, message: Memory, _state?: State) =>
    executeTradePipeline(runtime, message, "yes", "sell"),
};
