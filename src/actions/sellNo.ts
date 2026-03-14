import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import { executeTradePipeline } from "./tradeHelpers.js";

export const sellNo: Action = {
  name: "SELL_NO",
  description:
    "Sell NO shares on a FlipCoin prediction market. Requires condition ID and USDC amount.",
  similes: ["EXIT_NO", "CLOSE_NO"],

  examples: [
    [
      { name: "User", content: { text: "Sell $5 NO on 0xabc...def" } },
      { name: "Agent", content: { text: "Sold $5 of NO. Received: $4.85" } },
    ],
  ],

  validate: async (runtime: IAgentRuntime) =>
    !!runtime.getService<FlipCoinService>("FLIPCOIN"),

  handler: async (runtime: IAgentRuntime, message: Memory, _state?: State) =>
    executeTradePipeline(runtime, message, "no", "sell"),
};
