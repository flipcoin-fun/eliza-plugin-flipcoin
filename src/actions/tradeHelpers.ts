// ---------------------------------------------------------------------------
// Shared helpers for trade actions (buy/sell YES/NO)
// ---------------------------------------------------------------------------

import type { IAgentRuntime, Memory } from "@elizaos/core";
import { FlipCoinService } from "../services/FlipCoinService.js";
import type { TradeReceipt } from "../types/index.js";

export interface ParsedTradeParams {
  conditionId: string;
  usdcAmount: number; // human-readable float
  usdcRaw: string; // 6-decimal bigint string
}

/**
 * Extract conditionId and USDC amount from message text.
 * Returns null with error text if parsing fails.
 */
export function parseTradeMessage(text: string): ParsedTradeParams | string {
  const conditionMatch = text.match(/0x[a-fA-F0-9]{64}/);
  if (!conditionMatch) {
    return "Please provide a condition ID (0x... 64 hex chars).";
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

  // Parse params
  const parsed = parseTradeMessage(text);
  if (typeof parsed === "string") {
    return { success: false, text: parsed };
  }

  // Get quote first for policy check
  const quote = await svc.markets.getQuote({
    conditionId: parsed.conditionId,
    side,
    action,
    amount: parsed.usdcRaw,
  });

  // Hard policy gate (right before execution)
  const policyCheck = svc.policy.assertCanTrade(
    parsed.usdcAmount,
    quote,
    "open", // the intent endpoint will reject non-open markets anyway
  );

  if (!policyCheck.allowed) {
    return {
      success: false,
      text: `Trade blocked: ${policyCheck.reason}`,
    };
  }

  // Execute
  const receipt = await svc.trading.executeTrade({
    conditionId: parsed.conditionId,
    side,
    action,
    usdcAmount: parsed.usdcRaw,
  });

  // Record spend on success
  if (receipt.status === "submitted") {
    svc.policy.recordSpend(parsed.usdcAmount);
  }

  return {
    success: receipt.status !== "failed",
    text: formatReceipt(receipt, side, action, parsed.usdcAmount),
    values: { receipt },
  };
}

function formatReceipt(
  r: TradeReceipt,
  side: string,
  action: string,
  usdc: number,
): string {
  if (r.status === "failed") {
    return `Trade failed: ${r.message}`;
  }

  const sideLabel = side.toUpperCase();
  const lines = [
    `${action === "buy" ? "Bought" : "Sold"} $${usdc} of ${sideLabel}`,
    `Shares: ${r.quotedShares} | Fee: $${r.feeUsdc} | Impact: ${(r.priceImpactBps / 100).toFixed(1)}%`,
  ];

  if (r.txHash) lines.push(`Tx: ${r.txHash}`);
  if (r.status === "unknown") lines.push(r.message);

  return lines.join("\n");
}
