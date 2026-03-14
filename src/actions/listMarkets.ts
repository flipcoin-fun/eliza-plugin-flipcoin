// ---------------------------------------------------------------------------
// Action: LIST_MARKETS — browse open prediction markets
// ---------------------------------------------------------------------------

import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import type { ExploreParams } from "../types/index.js";

function formatMarketLine(m: {
  question: string;
  address: string;
  currentPriceYesBps: number;
  volumeUsdc: string;
  status: string;
}): string {
  const prob = (m.currentPriceYesBps / 100).toFixed(0);
  return `- ${m.question} (${prob}% YES, vol $${m.volumeUsdc}, ${m.status}) [${m.address}]`;
}

export const listMarkets: Action = {
  name: "LIST_MARKETS",
  description:
    "Browse FlipCoin prediction markets. Can filter by status, search term, or sort order.",
  similes: [
    "SHOW_MARKETS",
    "EXPLORE_MARKETS",
    "FIND_MARKETS",
    "SEARCH_MARKETS",
  ],

  examples: [
    [
      {
        name: "User",
        content: { text: "Show me the top prediction markets" },
      },
      {
        name: "Agent",
        content: {
          text: "Here are the top prediction markets by volume on FlipCoin.",
        },
      },
    ],
    [
      {
        name: "User",
        content: { text: "Search for Bitcoin markets" },
      },
      {
        name: "Agent",
        content: {
          text: "I found several Bitcoin-related prediction markets.",
        },
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

    // Extract simple params from message text
    const text = (message.content?.text ?? "").toLowerCase();
    const params: ExploreParams = { limit: 10, sort: "volume" };

    if (text.includes("trending")) params.sort = "trades";
    if (text.includes("new") || text.includes("recent"))
      params.sort = "created";
    if (text.includes("ending")) params.sort = "deadlineSoon";

    // Search term: anything after "search", "find", "about"
    const searchMatch = text.match(
      /(?:search|find|about|for)\s+["']?([^"'\n]+)/,
    );
    if (searchMatch) params.search = searchMatch[1].trim();

    const markets = await svc.markets.explore(params);

    if (markets.length === 0) {
      return {
        success: true,
        text: "No markets found matching your criteria.",
      };
    }

    const lines = markets.map(formatMarketLine);
    return {
      success: true,
      text: `Found ${markets.length} markets:\n${lines.join("\n")}`,
      values: { markets },
    };
  },
};
