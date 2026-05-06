// ---------------------------------------------------------------------------
// Shared helpers for trade actions (buy/sell YES/NO)
// ---------------------------------------------------------------------------

import type { IAgentRuntime, Memory } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import type { Quote, TradeReceipt } from "../types/index.js";

/**
 * Parsed trade params from a free-form user message.
 *
 * Buys are denominated in USDC (`amountType: "usdc"`). Sells are denominated
 * in shares (`amountType: "shares"`) because the Agent API requires
 * `sharesAmount` for `action: "sell"` — sending a USDC amount on sell is
 * rejected with HTTP 400.
 */
export interface ParsedTradeParams {
  conditionId: string;
  amountType: "usdc" | "shares";
  // Set when amountType === "usdc"
  usdcAmount?: number;
  usdcRaw?: string; // 6-decimal bigint string
  // Set when amountType === "shares"
  sharesAmount?: number;
  sharesRaw?: string; // 6-decimal bigint string (shares share USDC's 6-decimal scale)
}

/**
 * Extract conditionId and amount from message text.
 * - For `action: "buy"` (default): expects a USDC amount (`$5`, `10`).
 * - For `action: "sell"`: expects a shares amount with explicit `shares` keyword
 *   (`Sell 10 shares YES on 0x...`). The Agent API rejects USDC-denominated sells.
 *
 * Returns a string error message when parsing fails.
 */
export function parseTradeMessage(
  text: string,
  action: "buy" | "sell" = "buy",
): ParsedTradeParams | string {
  const conditionMatch = text.match(/0x[a-fA-F0-9]{64}/);
  if (!conditionMatch) {
    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      return "That looks like a market address. Use GET_MARKET to find the conditionId first.";
    }
    return "Please provide a condition ID (0x... 64 hex chars).";
  }

  if (action === "sell") {
    const sharesMatch = text.match(/(\d+(?:\.\d+)?)\s*shares?\b/i);
    if (!sharesMatch) {
      return 'Sell trades require a shares amount. Try: "Sell 10 shares YES on 0x...".';
    }
    const sharesAmount = parseFloat(sharesMatch[1]);
    if (sharesAmount <= 0 || !isFinite(sharesAmount)) {
      return "Shares amount must be a positive number.";
    }
    return {
      conditionId: conditionMatch[0],
      amountType: "shares",
      sharesAmount,
      sharesRaw: String(Math.round(sharesAmount * 1_000_000)),
    };
  }

  const amountMatch = text.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!amountMatch) {
    return "Please specify an amount (e.g. $5 or 10).";
  }

  const usdcAmount = parseFloat(amountMatch[1]);
  if (usdcAmount <= 0 || !isFinite(usdcAmount)) {
    return "Amount must be a positive number.";
  }

  return {
    conditionId: conditionMatch[0],
    amountType: "usdc",
    usdcAmount,
    usdcRaw: String(Math.round(usdcAmount * 1_000_000)),
  };
}

/**
 * Execute the full trade pipeline with policy checks.
 * Used by all 4 trade actions (buyYes, buyNo, sellYes, sellNo).
 */
export async function executeTradePipeline(
  runtime: IAgentRuntime,
  message: Memory,
  side: "yes" | "no",
  action: "buy" | "sell",
): Promise<{ success: boolean; text: string; values?: { receipt: TradeReceipt } }> {
  const svc = runtime.getService<FlipCoinService>("FLIPCOIN")!;
  const text = message.content?.text ?? "";

  const parsed = parseTradeMessage(text, action);
  if (typeof parsed === "string") {
    return { success: false, text: parsed };
  }

  const isSharesAmount = parsed.amountType === "shares";
  const apiAmountRaw = isSharesAmount ? parsed.sharesRaw! : parsed.usdcRaw!;

  // Get quote first for policy check
  const quote = await svc.markets.getQuote({
    conditionId: parsed.conditionId,
    side,
    action,
    amount: apiAmountRaw,
  });

  // Notional USDC for the policy gate.
  // - Buys: the requested USDC amount.
  // - Sells: the USDC the agent will receive (from the quote), since we
  //   only know shares upfront. amountOut is in 6-decimal raw units.
  const notionalUsdc = isSharesAmount
    ? deriveSellNotionalUsdc(quote)
    : parsed.usdcAmount!;

  const policyCheck = svc.policy.assertCanTrade(
    notionalUsdc,
    quote,
    "open", // the intent endpoint will reject non-open markets anyway
  );

  if (!policyCheck.allowed) {
    return {
      success: false,
      text: `Trade blocked: ${policyCheck.reason}`,
    };
  }

  // Execute. For sells we send sharesAmount; the API requires it for
  // action: "sell" and rejects usdcAmount with HTTP 400.
  const receipt = await svc.trading.executeTrade(
    isSharesAmount
      ? {
          conditionId: parsed.conditionId,
          side,
          action,
          sharesAmount: parsed.sharesRaw!,
        }
      : {
          conditionId: parsed.conditionId,
          side,
          action,
          usdcAmount: parsed.usdcRaw!,
        },
  );

  // Record spend only for buys — sells release capital, not consume it.
  if (receipt.status === "confirmed" && !isSharesAmount) {
    svc.policy.recordSpend(parsed.usdcAmount!);
  }

  return {
    success: receipt.status !== "failed",
    text: formatReceipt(receipt, side, action, parsed),
    values: { receipt },
  };
}

/** USDC the agent will receive from a sell quote, as a human-readable float. */
function deriveSellNotionalUsdc(quote: Quote): number {
  const rawOut = quote.lmsr?.amountOut ?? quote.clob?.amountOut ?? "0";
  const parsed = Number(rawOut);
  if (!isFinite(parsed) || parsed <= 0) return 0;
  return parsed / 1_000_000;
}

function formatReceipt(
  r: TradeReceipt,
  side: "yes" | "no",
  action: "buy" | "sell",
  parsed: ParsedTradeParams,
): string {
  if (r.status === "failed") {
    return `Trade failed: ${r.message}`;
  }

  const sideLabel = side.toUpperCase();
  const lines: string[] = [];

  if (action === "buy") {
    lines.push(`Bought $${parsed.usdcAmount} of ${sideLabel}`);
    lines.push(
      `Shares: ${r.quotedShares} | Fee: $${r.feeUsdc} | Impact: ${(r.priceImpactBps / 100).toFixed(1)}%`,
    );
  } else {
    const received =
      r.usdcOut && Number(r.usdcOut) > 0
        ? `$${(Number(r.usdcOut) / 1_000_000).toFixed(2)}`
        : "—";
    lines.push(`Sold ${parsed.sharesAmount} shares of ${sideLabel}`);
    lines.push(
      `Received: ${received} | Fee: $${r.feeUsdc} | Impact: ${(r.priceImpactBps / 100).toFixed(1)}%`,
    );
  }

  if (r.txHash) lines.push(`Tx: ${r.txHash}`);
  return lines.join("\n");
}
