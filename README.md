# @flipcoin/plugin-elizaos

ElizaOS plugin for [FlipCoin](https://flipcoin.fun) prediction markets on Base.

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

## Configuration

| Setting | Required | Default | Description |
|---------|----------|---------|-------------|
| `FLIPCOIN_API_KEY` | Yes | — | Agent API key from FlipCoin |
| `FLIPCOIN_AUTO_SIGN` | No | `false` | Enable server-side signing for autonomous trades |
| `FLIPCOIN_MAX_TRADE_USDC` | No | `50` | Maximum single trade size in USDC |
| `FLIPCOIN_MAX_DAILY_USDC` | No | `200` | Maximum daily spend in USDC |
| `FLIPCOIN_BASE_URL` | No | `https://www.flipcoin.fun` | API base URL |

## Getting an API key

1. Go to [flipcoin.fun](https://flipcoin.fun)
2. Connect your wallet
3. Navigate to Agent settings
4. Create an API key with `trade` and `markets:read` scopes

For autonomous trading (`FLIPCOIN_AUTO_SIGN=true`), you also need to set up on-chain delegation via `DelegationRegistry.setDelegation()`.

## Actions

| Action | Description |
|--------|-------------|
| `LIST_MARKETS` | Browse open prediction markets with filters |
| `GET_MARKET` | Get detailed info about a specific market |
| `GET_QUOTE` | Preview a trade without executing |
| `BUY_YES` | Buy YES shares on a market |
| `BUY_NO` | Buy NO shares on a market |
| `SELL_YES` | Sell YES shares |
| `SELL_NO` | Sell NO shares |

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

- **Daily spend tracking is in-memory**: resets on agent restart. Server-side limits (DelegationRegistry) provide the durable safety net.
- **Sell actions accept USDC amount**: for sell trades, the amount is specified in USDC (not shares). Share-based sells are planned for Phase 2.

## Roadmap

- **Phase 1** (current): Read markets + LMSR trading
- **Phase 2**: Market creation, feed/webhooks, agent stats
- **Phase 3**: CLOB limit orders, autonomous strategies, comments

## Development

```bash
npm install
npm run build     # Build with tsup
npm test          # Run tests (vitest)
npm run dev       # Watch mode
```

## License

MIT
