// ---------------------------------------------------------------------------
// Action: GET_QUOTE — get a price quote without executing
// ---------------------------------------------------------------------------

import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";

export const getQuote: Action = {
  name: "GET_QUOTE",
  description:
    "Get a price quote for buying/selling YES or NO shares on a FlipCoin market. Does not execute a trade.",
  similes: ["PRICE_CHECK", "QUOTE_TRADE", "HOW_MUCH"],

  examples: [
    [
      {
        name: "User",
        content: {
          text: "How much to buy $10 of YES on 0xabc123...?",
        },
      },
      {
        name: "Agent",
        content: {
          text: "For $10 you would receive approximately 15.2 YES shares.",
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
    const text = (message.content?.text ?? "").toLowerCase();

    // Parse: conditionId or address, side, action, amount
    const conditionMatch = text.match(/0x[a-fA-F0-9]{64}/);
    if (!conditionMatch) {
      return {
        success: false,
        text: "Please provide a condition ID (0x... 64 hex chars) to quote.",
      };
    }

    const side = text.includes("no") ? "no" : "yes";
    const action = text.includes("sell") ? "sell" : "buy";

    const amountMatch = text.match(/\$?\s*(\d+(?:\.\d+)?)/);
    const usdcFloat = amountMatch ? parseFloat(amountMatch[1]) : 1;
    const amountRaw = String(Math.round(usdcFloat * 1_000_000));

    const quote = await svc.markets.getQuote({
      conditionId: conditionMatch[0],
      side,
      action,
      amount: amountRaw,
    });

    const lmsr = quote.lmsr;
    if (!lmsr) {
      return {
        success: true,
        text: `No LMSR quote available. CLOB best ${side === "yes" ? "ask" : "bid"}: ${(quote.clob?.bestAskBps ?? 0) / 100}%`,
        values: { quote },
      };
    }

    const avgPrice = (lmsr.avgPriceBps / 100).toFixed(1);
    const impact = (lmsr.priceImpactBps / 100).toFixed(1);

    return {
      success: true,
      text: [
        `Quote: ${action} $${usdcFloat} of ${side.toUpperCase()}`,
        `Shares: ${lmsr.sharesOut} | Avg price: ${avgPrice}% | Fee: $${lmsr.fee}`,
        `Price impact: ${impact}% (${quote.priceImpactGuard.level})`,
        `Valid until: ${quote.validUntil}`,
      ].join("\n"),
      values: { quote },
    };
  },
};
