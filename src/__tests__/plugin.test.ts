import { describe, it, expect } from "vitest";
import { flipcoinPlugin } from "../index.js";

describe("flipcoinPlugin manifest", () => {
  it("has correct name and description", () => {
    expect(flipcoinPlugin.name).toBe("flipcoin");
    expect(flipcoinPlugin.description).toContain("FlipCoin");
  });

  it("exports 7 actions", () => {
    expect(flipcoinPlugin.actions).toHaveLength(7);
    const names = flipcoinPlugin.actions!.map((a) => a.name);
    expect(names).toContain("LIST_MARKETS");
    expect(names).toContain("GET_MARKET");
    expect(names).toContain("GET_QUOTE");
    expect(names).toContain("BUY_YES");
    expect(names).toContain("BUY_NO");
    expect(names).toContain("SELL_YES");
    expect(names).toContain("SELL_NO");
  });

  it("exports 3 providers", () => {
    expect(flipcoinPlugin.providers).toHaveLength(3);
    const names = flipcoinPlugin.providers!.map((p) => p.name);
    expect(names).toContain("flipcoin-markets");
    expect(names).toContain("flipcoin-portfolio");
    expect(names).toContain("flipcoin-capabilities");
  });

  it("exports 1 evaluator", () => {
    expect(flipcoinPlugin.evaluators).toHaveLength(1);
    expect(flipcoinPlugin.evaluators![0].name).toBe(
      "flipcoin-should-trade",
    );
  });

  it("exports 1 service", () => {
    expect(flipcoinPlugin.services).toHaveLength(1);
  });

  it("all actions have examples", () => {
    for (const action of flipcoinPlugin.actions!) {
      expect(action.examples?.length).toBeGreaterThan(0);
    }
  });

  it("all actions have handler and validate", () => {
    for (const action of flipcoinPlugin.actions!) {
      expect(typeof action.handler).toBe("function");
      expect(typeof action.validate).toBe("function");
    }
  });
});
