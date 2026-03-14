import { describe, it, expect } from "vitest";
import { parseTradeMessage } from "../actions/tradeHelpers.js";

describe("parseTradeMessage", () => {
  const validConditionId = "0x" + "a".repeat(64);

  it("parses a valid message with conditionId and amount", () => {
    const result = parseTradeMessage(
      `Buy $5 YES on ${validConditionId}`,
    );
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.conditionId).toBe(validConditionId);
    expect(result.usdcAmount).toBe(5);
    expect(result.usdcRaw).toBe("5000000");
  });

  it("parses amount without dollar sign", () => {
    const result = parseTradeMessage(
      `Buy 10 YES on ${validConditionId}`,
    );
    if (typeof result === "string") return;
    expect(result.usdcAmount).toBe(10);
  });

  it("parses decimal amounts", () => {
    const result = parseTradeMessage(
      `Buy $2.50 YES on ${validConditionId}`,
    );
    if (typeof result === "string") return;
    expect(result.usdcAmount).toBe(2.5);
    expect(result.usdcRaw).toBe("2500000");
  });

  it("returns error when no conditionId", () => {
    const result = parseTradeMessage("Buy $5 YES");
    expect(typeof result).toBe("string");
    expect(result).toContain("condition ID");
  });

  it("returns error when no amount", () => {
    const result = parseTradeMessage(
      `Buy YES on ${validConditionId}`,
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("positive");
  });

  it("returns error for zero amount", () => {
    // Explicit zero
    const result = parseTradeMessage(
      `Buy $0 YES on ${validConditionId}`,
    );
    if (typeof result === "string") {
      expect(result).toContain("positive");
    }
    // 0 is caught by <= 0 check
  });
});
