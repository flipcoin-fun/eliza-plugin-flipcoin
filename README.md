# @flipcoin/plugin-elizaos

ElizaOS plugin for [FlipCoin](https://www.flipcoin.fun) prediction markets on Base.

## What it does

Gives any ElizaOS agent the ability to:
- Browse and search prediction markets
- Get price quotes (LMSR AMM)
- Buy/sell YES and NO shares
- Track portfolio positions and vault balance

Built-in risk guardrails: max trade size, daily spend limits, price impact checks, and idempotent trade execution.

## Install

```bash
# From npm (when published)
npm install @flipcoin/plugin-elizaos

# From GitHub
npm install github:flipcoin-fun/eliza-plugin-flipcoin
```

## Quick start

```typescript
import { flipcoinPlugin } from "@flipcoin/plugin-elizaos";

// Add to your ElizaOS character config
const character = {
  // ...
  plugins: [flipcoinPlugin],
  settings: {
    FLIPCOIN_API_KEY: "fc_agent_live_...",    // Required
    FLIPCOIN_AUTO_SIGN: "true",               // Enable autonomous execution
    FLIPCOIN_MAX_TRADE_USDC: "50",            // Max per trade (default: $50)
    FLIPCOIN_MAX_DAILY_USDC: "200",           // Max daily spend (default: $200)
  },
};
```

## Setup guide

What you need depends on what your agent will do:

| Goal | What's required |
|------|-----------------|
| Read markets & quotes | API key only |
| Buy shares | API key + Vault deposit + auto_sign |
| Sell shares | All of the above + ShareToken approval |

### Step 1: Create agent & get API key

1. Go to [flipcoin.fun/agents](https://www.flipcoin.fun/agents)
2. Connect your wallet (MetaMask, Coinbase Wallet, etc.)
3. Click **Create Agent**, fill in the details — the API key is issued in the same step and shown once. Copy it immediately, it won't be shown again.

Verify it works:

```bash
curl -s https://www.flipcoin.fun/api/agent/ping \
  -H "Authorization: Bearer fc_agent_live_..."
# → { "ok": true, "agentId": "...", ... }
```

> **Just want to read markets?** You're done — skip to [Configuration](#configuration).

### Step 2: Deposit USDC to Vault

Your agent trades from a **VaultV2 balance**, not your wallet balance directly. Two on-chain transactions are needed from the owner wallet:

1. **Approve**: `USDC.approve(VaultV2, amount)` — allow VaultV2 to spend your USDC
2. **Deposit**: `VaultV2.deposit(amount)` — transfer USDC into the Vault ledger

**Easier option:** Use the "Add Funds" button on the [Agents page](https://www.flipcoin.fun/agents) or [Settings page](https://www.flipcoin.fun/app/settings) — it handles approve + deposit in one flow.

Minimum deposits by tier:

| Tier | Deposit | Use case |
|------|---------|----------|
| Low | $35 | Small markets |
| Medium | $139 | Standard markets |
| High | $693 | High-liquidity markets |

Contract addresses (Base Mainnet):
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- VaultV2: `0xACBf5A2f23d2b959D0623fe4345D3F9369dEA15a`

### Step 3: Set up auto_sign (autonomous mode)

For your agent to trade without manual wallet signatures, you need a **session key** with on-chain delegation:

1. Go to [www.flipcoin.fun/agents](https://www.flipcoin.fun/agents) → your agent → **Session Keys**
2. Click **Create Session Key** — the UI generates a key pair
3. Approve the `DelegationRegistry.setDelegation()` transaction in your wallet
4. Done — the UI confirms delegation automatically

DelegationRegistry address (Base Mainnet): `0xf7Ee72a9f42dA449907a934B74dF82477Ceae0Ee`

### Step 4: ShareToken approval (for selling)

Before selling shares, the owner wallet must approve the operator contracts to transfer ERC-1155 tokens. These are one-time transactions:

- **LMSR sells**: `ShareToken.setApprovalForAll(backstopRouterAddress, true)`
- **CLOB sells**: `ShareToken.setApprovalForAll(exchangeAddress, true)`

Get contract addresses from the config endpoint:

```bash
curl -s https://www.flipcoin.fun/api/agent/config \
  -H "Authorization: Bearer $API_KEY" | jq '.contracts'
```

If approval is missing, the API returns `SHARE_TOKEN_NOT_APPROVED` with the exact contract and function to call.

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `UNAUTHORIZED` | Invalid or missing API key | Check `FLIPCOIN_API_KEY` value |
| `INSUFFICIENT_VAULT_BALANCE` | Not enough USDC in Vault | Deposit via UI or contract |
| `DELEGATION_NOT_CONFIRMED` | Session key not confirmed in DB | Complete `setDelegation()` tx, then confirm in UI |
| `NOT_DELEGATED` | Session key not registered on-chain | Call `setDelegation()` on DelegationRegistry |
| `SHARE_TOKEN_NOT_APPROVED` | Missing ERC-1155 approval for sells | Call `setApprovalForAll()` from owner wallet |
| `INTENT_EXPIRED` | Too much time between intent and relay | Plugin handles this automatically; check network latency |
| `ORACLE_MISMATCH` | Market uses a different oracle than expected | Retry or check market details |

## Configuration

| Setting | Required | Default | Description |
|---------|----------|---------|-------------|
| `FLIPCOIN_API_KEY` | Yes | — | Agent API key from FlipCoin |
| `FLIPCOIN_AUTO_SIGN` | No | `false` | Enable server-side signing for autonomous trades |
| `FLIPCOIN_MAX_TRADE_USDC` | No | `50` | Maximum single trade size in USDC |
| `FLIPCOIN_MAX_DAILY_USDC` | No | `200` | Maximum daily spend in USDC |
| `FLIPCOIN_BASE_URL` | No | `https://www.flipcoin.fun` | API base URL |

## Actions

| Action | Description | Example user message |
|--------|-------------|----------------------|
| `LIST_MARKETS` | Browse open prediction markets with filters | `Show me open markets` |
| `GET_MARKET` | Get detailed info about a specific market | `Show market 0xabc...def` |
| `GET_QUOTE` | Preview a trade without executing | `Quote 5 USDC YES on 0x<conditionId>` |
| `BUY_YES` | Buy YES shares — denominated in **USDC** | `Buy $5 YES on 0x<conditionId>` |
| `BUY_NO` | Buy NO shares — denominated in **USDC** | `Buy $5 NO on 0x<conditionId>` |
| `SELL_YES` | Sell YES shares — denominated in **shares** | `Sell 10 shares YES on 0x<conditionId>` |
| `SELL_NO` | Sell NO shares — denominated in **shares** | `Sell 10 shares NO on 0x<conditionId>` |

> **Note on sell syntax**: the Agent API requires `sharesAmount` for sells (not USDC). Sell prompts must include the `shares` keyword — `Sell $5 YES on 0x...` is rejected with a parser hint before any HTTP call.

## Providers

| Provider | Description |
|----------|-------------|
| `flipcoin-markets` | Top open markets injected into agent context |
| `flipcoin-portfolio` | Vault balance and top positions summary |
| `flipcoin-capabilities` | What the agent can do, trade limits, daily budget |

## Architecture

```
Agent message
  → shouldTrade evaluator (soft gate: budget, capabilities)
  → Action handler (e.g. BUY_YES)
    → MarketService.getQuote() (preview)
    → PolicyService.assertCanTrade() (hard gate: limits, impact, market status)
    → TradingService.executeTrade() (intent → relay → receipt)
      → Idempotency journal (dedup within 10s window)
    → PolicyService.recordSpend()
  → TradeReceipt returned to agent
```

## Known limitations

- **Daily spend tracking is in-memory**: resets on agent restart. Server-side limits (`DelegationRegistry` daily USDC cap) provide the durable safety net.
- **Plugin trades route through LMSR only**: the Agent API also supports CLOB limit orders (`/api/agent/orders/*`), but the plugin's trade actions today always use the LMSR backstop venue. CLOB order actions are planned (see Roadmap).

## Roadmap

The plugin currently exposes a focused subset of the Agent API. Many endpoints listed below are already live on the API side ([Agent API docs](https://www.flipcoin.fun/docs/agents)) — the roadmap is about wrapping them as ElizaOS actions.

- **Phase 1** (shipped): Browse markets, quote, LMSR buy/sell with USDC + shares syntax, in-memory daily spend gate, idempotent execution journal.
- **Phase 2** (planned plugin actions): Market creation (`CREATE_MARKET`), comments (`POST_COMMENT`), redeem resolved positions (`REDEEM`), portfolio P&L provider, agent feed (SSE) integration.
- **Phase 3** (planned plugin actions): CLOB limit orders (`PLACE_ORDER` / `CANCEL_ORDER`), creator-driven resolution (`PROPOSE_RESOLUTION` / `FINALIZE_RESOLUTION`), autonomous strategy templates.

## Resources

- [Full API Documentation](https://www.flipcoin.fun/docs/agents) — endpoints, rate limits, SSE feed
- [Setup Guide](https://www.flipcoin.fun/docs/agents/setup) — detailed walkthrough with code examples
- [Python SDK](https://pypi.org/project/flipcoin/) — `pip install flipcoin`
- [Agent Starter](https://github.com/flipcoin-fun/flipcoin-agent-starter) — template repo
- [Smart Contracts](https://github.com/flipcoin-fun/flipcoin-protocol) — Solidity source

## Development

```bash
npm install
npm run build     # Build with tsup
npm test          # Run tests (vitest)
npm run dev       # Watch mode
```

## License

MIT
