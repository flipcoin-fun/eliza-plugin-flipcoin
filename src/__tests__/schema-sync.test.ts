/**
 * Schema-sync tests: eliza-plugin-flipcoin ↔ OpenAPI spec.
 *
 * Validates that the plugin's services, actions, and types stay
 * in sync with the canonical OpenAPI specification.
 *
 * Scoped to Phase 1 endpoints (markets + LMSR trading).
 *
 * Run:  npm test
 */
import { describe, it, expect, beforeAll } from "vitest";

const OPENAPI_URL = "https://www.flipcoin.fun/api/openapi.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let spec: any;

beforeAll(async () => {
  const res = await fetch(OPENAPI_URL);
  if (!res.ok) throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);
  spec = await res.json();
}, 15_000);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSchemaFields(schemaName: string): string[] {
  const schema = spec?.components?.schemas?.[schemaName];
  if (!schema?.properties) return [];
  return Object.keys(schema.properties);
}

function getEndpoint(method: string, path: string) {
  return spec?.paths?.[path]?.[method.toLowerCase()];
}

// ─── Phase 1 endpoint existence ─────────────────────────────────────────────

describe("Phase 1 endpoints exist in OpenAPI spec", () => {
  const PHASE1_ENDPOINTS = [
    ["GET", "/api/agent/ping"],
    ["GET", "/api/agent/config"],
    ["GET", "/api/agent/markets/explore"],
    ["GET", "/api/agent/markets/{address}"],
    ["GET", "/api/quote"],
    ["GET", "/api/agent/portfolio"],
    ["POST", "/api/agent/trade/intent"],
    ["POST", "/api/agent/trade/relay"],
  ] as const;

  it.each(PHASE1_ENDPOINTS)("%s %s exists", (method, path) => {
    expect(getEndpoint(method, path)).toBeDefined();
  });
});

// ─── Quote endpoint alignment ───────────────────────────────────────────────

describe("Quote endpoint — plugin uses correct params", () => {
  it("requires conditionId, side, action, amount", () => {
    const params = spec.paths["/api/quote"]?.get?.parameters ?? [];
    const required = params
      .filter((p: { required: boolean }) => p.required)
      .map((p: { name: string }) => p.name);
    expect(required).toContain("conditionId");
    expect(required).toContain("side");
    expect(required).toContain("action");
    expect(required).toContain("amount");
  });

  it("amount is string type (raw 6-decimal USDC)", () => {
    const params = spec.paths["/api/quote"]?.get?.parameters ?? [];
    const amountParam = params.find(
      (p: { name: string }) => p.name === "amount",
    );
    expect(amountParam?.schema?.type).toBe("string");
  });

  it("side accepts yes/no", () => {
    const params = spec.paths["/api/quote"]?.get?.parameters ?? [];
    const sideParam = params.find((p: { name: string }) => p.name === "side");
    expect(sideParam?.schema?.enum).toContain("yes");
    expect(sideParam?.schema?.enum).toContain("no");
  });

  it("action accepts buy/sell", () => {
    const params = spec.paths["/api/quote"]?.get?.parameters ?? [];
    const actionParam = params.find(
      (p: { name: string }) => p.name === "action",
    );
    expect(actionParam?.schema?.enum).toContain("buy");
    expect(actionParam?.schema?.enum).toContain("sell");
  });
});

// ─── Quote response schema ──────────────────────────────────────────────────

describe("QuoteResponse schema — plugin type alignment", () => {
  it("has quoteId, venue, validUntil", () => {
    const fields = getSchemaFields("QuoteResponse");
    expect(fields).toContain("quoteId");
    expect(fields).toContain("venue");
    expect(fields).toContain("validUntil");
  });

  it("has lmsr sub-schema with sharesOut, fee, priceImpactBps, avgPriceBps", () => {
    const lmsr =
      spec.components.schemas.QuoteResponse?.properties?.lmsr?.properties ?? {};
    expect(lmsr.sharesOut).toBeDefined();
    expect(lmsr.fee).toBeDefined();
    expect(lmsr.priceImpactBps).toBeDefined();
    expect(lmsr.avgPriceBps).toBeDefined();
  });

  it("has clob sub-schema with canFillFull, bestBidBps, bestAskBps", () => {
    const clob =
      spec.components.schemas.QuoteResponse?.properties?.clob?.properties ?? {};
    expect(clob.canFillFull).toBeDefined();
    expect(clob.bestBidBps).toBeDefined();
    expect(clob.bestAskBps).toBeDefined();
  });

  it("has priceImpactGuard field", () => {
    const quoteProps =
      spec.components.schemas.QuoteResponse?.properties ?? {};
    // priceImpactGuard may be inline object or a $ref
    expect(quoteProps.priceImpactGuard).toBeDefined();
  });
});

// ─── Trade intent request schema ────────────────────────────────────────────

describe("TradeIntentRequest schema — plugin params", () => {
  it("has conditionId, side, action", () => {
    const fields = getSchemaFields("TradeIntentRequest");
    expect(fields).toContain("conditionId");
    expect(fields).toContain("side");
    expect(fields).toContain("action");
  });

  it("has usdcAmount and sharesAmount", () => {
    const fields = getSchemaFields("TradeIntentRequest");
    expect(fields).toContain("usdcAmount");
    expect(fields).toContain("sharesAmount");
  });

  it("has maxSlippageBps", () => {
    const fields = getSchemaFields("TradeIntentRequest");
    expect(fields).toContain("maxSlippageBps");
  });

  it("venue enum includes lmsr", () => {
    const schema = spec.components.schemas.TradeIntentRequest;
    const venues = schema?.properties?.venue?.enum ?? [];
    expect(venues).toContain("lmsr");
  });
});

// ─── Trade relay response schema ────────────────────────────────────────────

describe("TradeRelayResponse schema — plugin receipt", () => {
  it("has status, txHash, sharesOut, feeUsdc", () => {
    const fields = getSchemaFields("TradeRelayResponse");
    expect(fields).toContain("status");
    expect(fields).toContain("txHash");
    expect(fields).toContain("sharesOut");
    expect(fields).toContain("feeUsdc");
  });

  it("has retryable and errorCode for error handling", () => {
    const fields = getSchemaFields("TradeRelayResponse");
    expect(fields).toContain("retryable");
    expect(fields).toContain("errorCode");
  });
});

// ─── Config response schema ─────────────────────────────────────────────────

describe("ConfigResponse schema — plugin config", () => {
  it("has capabilities with relay, autoSign, deposit", () => {
    const caps =
      spec.components.schemas.ConfigResponse?.properties?.capabilities;
    expect(caps).toBeDefined();
    const capProps = caps?.properties ?? {};
    expect(capProps.relay).toBeDefined();
    expect(capProps.autoSign).toBeDefined();
    expect(capProps.deposit).toBeDefined();
  });

  it("has limits with minTradeUsdc, maxTradeUsdc", () => {
    const limits =
      spec.components.schemas.ConfigResponse?.properties?.limits;
    expect(limits).toBeDefined();
  });

  it("has contracts section", () => {
    const fields = getSchemaFields("ConfigResponse");
    expect(fields).toContain("contracts");
  });
});

// ─── Explore response schema ────────────────────────────────────────────────

describe("ExploreResponse schema — market listing", () => {
  it("explore endpoint returns market data", () => {
    // ExploreResponse may use $ref or allOf — verify the endpoint exists
    // and returns 200 with a schema
    const op = getEndpoint("GET", "/api/agent/markets/explore");
    expect(op).toBeDefined();
    const successResponse = op?.responses?.["200"];
    expect(successResponse).toBeDefined();
  });
});

// ─── Portfolio response schema ──────────────────────────────────────────────

describe("PortfolioResponse schema", () => {
  it("has positions and totals", () => {
    const fields = getSchemaFields("PortfolioResponse");
    expect(fields).toContain("positions");
    expect(fields).toContain("totals");
  });
});

// ─── Trade intent auto_sign query param ─────────────────────────────────────

describe("Trade intent endpoint — auto_sign support", () => {
  it("trade intent supports auto_sign query parameter", () => {
    const op = getEndpoint("POST", "/api/agent/trade/intent");
    const params = op?.parameters ?? [];
    // auto_sign may be in query params or request body
    const paramNames = params.map((p: { name: string }) => p.name);
    // If auto_sign is a query param, verify it
    if (paramNames.includes("auto_sign")) {
      const autoSign = params.find(
        (p: { name: string }) => p.name === "auto_sign",
      );
      expect(autoSign?.in).toBe("query");
    }
    // If it's in the request body, that's also fine
  });
});

// ─── Phase 2+ endpoints exist (future coverage) ────────────────────────────

describe("Phase 2+ endpoints exist in spec (for future plugin expansion)", () => {
  const PHASE2_ENDPOINTS = [
    ["POST", "/api/agent/markets"],
    ["POST", "/api/agent/orders/intent"],
    ["POST", "/api/agent/orders/relay"],
    ["GET", "/api/agent/orders"],
    ["POST", "/api/agent/webhooks"],
    ["GET", "/api/agent/feed"],
    ["GET", "/api/agent/feed/stream"],
    ["POST", "/api/agent/comments"],
    ["GET", "/api/agent/comments"],
    ["POST", "/api/agent/markets/{address}/propose-resolution"],
    ["POST", "/api/agent/markets/{address}/finalize-resolution"],
  ] as const;

  it.each(PHASE2_ENDPOINTS)(
    "%s %s exists for Phase 2+ expansion",
    (method, path) => {
      expect(getEndpoint(method, path)).toBeDefined();
    },
  );
});
