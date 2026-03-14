import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import { executeTradePipeline } from "./tradeHelpers.js";

export const buyNo: Action = {
  name: "BUY_NO",
  description:
    "Buy NO shares on a FlipCoin prediction market. Requires condition ID and USDC amount.",
  similes: ["BET_NO", "SHORT_YES", "GO_NO", "BET_AGAINST"],

  examples: [
    [
      { name: "User", content: { text: "Buy $10 NO on 0xabc...def" } },
      { name: "Agent", content: { text: "Bought $10 of NO. Shares: 14.5, Fee: $0.10" } },
    ],
  ],

  validate: async (runtime: IAgentRuntime) =>
    !!runtime.getService<FlipCoinService>("FLIPCOIN"),

  handler: async (runtime: IAgentRuntime, message: Memory, _state?: State) =>
    executeTradePipeline(runtime, message, "no", "buy"),
};
