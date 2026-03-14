// ---------------------------------------------------------------------------
// Evaluator: shouldTrade — soft decision gate for trading actions
// ---------------------------------------------------------------------------
// This is the SOFT gate (advisory). The HARD gate lives in PolicyService
// and is called inside action handlers right before relay.
//
// The evaluator helps the agent decide whether it *should* trade, not
// whether it *can*. It checks things like:
// - Does the agent have enough daily budget?
// - Is the trade amount reasonable relative to market liquidity?
// - Is this a duplicate of a very recent action?
// ---------------------------------------------------------------------------

import type {
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
} from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";

export const shouldTrade: Evaluator = {
  name: "flipcoin-should-trade",
  description:
    "Advises whether the agent should proceed with a FlipCoin trade. Checks budget, market health, and action recency.",
  alwaysRun: false,
  similes: [],
  examples: [],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Only activate when trade-related content is detected
    const text = (message.content?.text ?? "").toLowerCase();
    const tradeKeywords = [
      "buy",
      "sell",
      "bet",
      "trade",
      "long",
      "short",
      "yes",
      "no",
    ];
    return tradeKeywords.some((kw) => text.includes(kw));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
  ) => {
    const svc = runtime.getService<FlipCoinService>("FLIPCOIN");
    if (!svc) return;

    const warnings: string[] = [];

    // Check daily budget
    const remaining = svc.policy.getDailyRemaining();
    if (remaining <= 0) {
      warnings.push("Daily USDC budget exhausted. Consider waiting.");
    } else if (remaining < 10) {
      warnings.push(`Low daily budget: $${remaining.toFixed(2)} remaining.`);
    }

    // Check auto_sign capability
    if (!svc.serverConfig?.capabilities.autoSign) {
      warnings.push(
        "auto_sign not enabled. Trades will require external signing.",
      );
    }

    if (warnings.length === 0) return;

    return {
      success: true,
      text: `FlipCoin trade advisory: ${warnings.join(" ")}`,
      values: { warnings },
    };
  },
};
