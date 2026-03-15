// ---------------------------------------------------------------------------
// Provider: marketContext — injects top open markets into agent context
// ---------------------------------------------------------------------------

import type { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import type { MarketSummary } from "../types/index.js";

const MAX_MARKETS = 7;

function hoursUntil(isoDate: string | null): string {
  if (!isoDate) return "no deadline";
  const ms = new Date(isoDate).getTime() - Date.now();
  if (ms < 0) return "expired";
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return "<1h left";
  if (h < 24) return `${h}h left`;
  return `${Math.round(h / 24)}d left`;
}

function summarize(m: MarketSummary): string {
  const prob = ((m.currentPriceYesBps ?? 5000) / 100).toFixed(0);
  return `${m.title} — ${prob}% YES, $${m.volumeUsdc} vol, ${hoursUntil(m.resolveEndAt ?? null)} [${m.conditionId}]`;
}

export const marketContext: Provider = {
  name: "flipcoin-markets",
  description:
    "Top open prediction markets on FlipCoin with current probabilities",
  dynamic: true,
  position: 10,
  private: false,

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const svc = runtime.getService<FlipCoinService>("FLIPCOIN");
    if (!svc) return { text: "", data: {}, values: {} };

    try {
      const markets = await svc.markets.explore({
        status: "open",
        sort: "volume",
        limit: MAX_MARKETS,
      });

      if (markets.length === 0) {
        return {
          text: "FlipCoin: No open markets right now.",
          data: {},
          values: {},
        };
      }

      const lines = markets.map(summarize);
      return {
        text: `FlipCoin open markets (top ${markets.length}):\n${lines.join("\n")}`,
        data: { marketCount: markets.length },
        values: {},
      };
    } catch {
      return { text: "FlipCoin: markets unavailable", data: {}, values: {} };
    }
  },
};
