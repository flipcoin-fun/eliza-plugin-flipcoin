// ---------------------------------------------------------------------------
// Provider: portfolioContext — injects vault balance + top positions summary
// ---------------------------------------------------------------------------

import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";

const MAX_POSITIONS = 3;

export const portfolioContext: Provider = {
  name: "flipcoin-portfolio",
  description:
    "Agent's FlipCoin vault balance and top open positions",
  dynamic: true,
  position: 11,
  private: true, // only visible to the agent, not shared

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const svc = runtime.getService<FlipCoinService>("FLIPCOIN");
    if (!svc) return { text: "", data: {}, values: {} };

    try {
      const portfolio = await svc.markets.getPortfolio();
      const openPositions = portfolio.positions.filter(
        (p) => p.status === "open",
      );

      const lines: string[] = [
        `FlipCoin vault: $${portfolio.vaultBalance} | ${openPositions.length} open positions`,
      ];

      // Top positions by current value
      const sorted = [...openPositions].sort(
        (a, b) =>
          parseFloat(b.currentValueUsdc) - parseFloat(a.currentValueUsdc),
      );

      for (const p of sorted.slice(0, MAX_POSITIONS)) {
        const side =
          parseFloat(p.yesShares) > parseFloat(p.noShares) ? "YES" : "NO";
        const shares =
          side === "YES" ? p.yesShares : p.noShares;
        lines.push(
          `  ${p.question} — ${shares} ${side}, value $${p.currentValueUsdc}, PnL $${p.pnlUsdc}`,
        );
      }

      if (sorted.length > MAX_POSITIONS) {
        lines.push(`  ...and ${sorted.length - MAX_POSITIONS} more`);
      }

      return {
        text: lines.join("\n"),
        data: {
          vaultBalance: portfolio.vaultBalance,
          openCount: openPositions.length,
        },
        values: {},
      };
    } catch {
      return {
        text: "FlipCoin portfolio: unavailable",
        data: {},
        values: {},
      };
    }
  },
};
