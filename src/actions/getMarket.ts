// ---------------------------------------------------------------------------
// Action: GET_MARKET — get detailed info about a specific market
// ---------------------------------------------------------------------------

import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";

export const getMarket: Action = {
  name: "GET_MARKET",
  description:
    "Get detailed information about a specific FlipCoin prediction market by address.",
  similes: ["MARKET_DETAIL", "MARKET_INFO", "CHECK_MARKET"],

  examples: [
    [
      {
        name: "User",
        content: { text: "Tell me about market 0xabc123..." },
      },
      {
        name: "Agent",
        content: { text: "Here are the details for that prediction market." },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime) => {
    return !!runtime.getService<FlipCoinService>("FLIPCOIN");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ) => {
    const svc = runtime.getService<FlipCoinService>("FLIPCOIN")!;
    const text = message.content?.text ?? "";

    // Extract 0x address from message
    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) {
      return {
        success: false,
        text: "Please provide a market address (0x...) to look up.",
      };
    }

    const detail = await svc.markets.getDetail(addressMatch[0]);
    const prob = (detail.currentPriceYesBps / 100).toFixed(0);

    return {
      success: true,
      text: [
        `**${detail.question}**`,
        `Status: ${detail.status} | YES: ${prob}% | Volume: $${detail.volumeUsdc}`,
        detail.description ? `Description: ${detail.description}` : null,
        detail.resolutionCriteria
          ? `Resolution: ${detail.resolutionCriteria}`
          : null,
        `Vault: $${detail.vaultBalance} | 24h vol: $${detail.stats.volume24h} (${detail.stats.trades24h} trades)`,
        `Address: ${detail.address}`,
        `Condition ID: ${detail.conditionId}`,
      ]
        .filter(Boolean)
        .join("\n"),
      values: { market: detail },
    };
  },
};
