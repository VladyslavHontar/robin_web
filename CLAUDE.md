# Robin DLMM Dashboard

## What This Is

A monitoring dashboard ("microscope") for the Robin DLMM DEX deployed on Robinhood Chain. Read-only. No swaps, no liquidity management — purely observation. Shows pool states, bin liquidity distributions, oracle data, fee parameters, and compliance status across all deployed pairs.

## Reference

- **Inspiration**: [Meteora DLMM](https://app.meteora.ag) — their bin liquidity visualization and pool detail pages
- **Smart contracts repo**: `/Users/newuser/RustroverProjects/robin/` (Foundry project)
- **Contract interfaces**: `src/interfaces/ILBPair.sol`, `ILBFactory.sol`, `IOracleModule.sol`, `ILBPairTypes.sol`

## Robinhood Chain

| Property | Testnet | Mainnet |
|----------|---------|---------|
| Chain ID | 46630 | TBD |
| RPC | https://rpc.testnet.chain.robinhood.com | TBD |
| Explorer | https://explorer.testnet.chain.robinhood.com | TBD |
| Gas Token | ETH | ETH |
| Type | Arbitrum Orbit L2 (EVM-compatible) | Same |

The chain is standard EVM. No special adapters needed — viem/ethers work out of the box with the RPC URL and chain ID.

## Deployed Contracts (Testnet)

```
LBFactory:        0x30f8819710611d80Ce22d57947223F33C2fe8C9E
LBRouter:         0x7A112f26C32763B1b774899668EEfd3E0DF06447
ComplianceModule: 0xEFb56C901723c03DcddC8Bf38e2737d58D71c26B
IdentityRegistry: 0x40e9724795d9E14668e76455622017a5a3Ffb745
ClaimIssuer:      0xf026822323142eAe64112AEe6130a862E659453A
WETH:             0xD01e5E257ea5014E92BDD5b746eD63815Ee8ffD4
```

### Pairs (Testnet)

| Pair | Address | Bin Step |
|------|---------|----------|
| AMZN/WETH | 0x8B5018e08c25189fF6764d325b80ae581651A884 | 50bp |
| AMD/WETH  | 0x06b887C0206f0b2A71175eA875931f6611107849 | 50bp |
| NFLX/WETH | 0x19CceaB5352148151491f3766F8074DBE3e9349a | 50bp |

### Tokens (Testnet)

| Token | Address | Decimals |
|-------|---------|----------|
| AMZN | 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02 | 18 |
| AMD  | 0x71178BAc73cBeb415514eB542a8995b82669778d | 18 |
| NFLX | 0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93 | 18 |
| WETH | 0xD01e5E257ea5014E92BDD5b746eD63815Ee8ffD4 | 18 |

## Technology Stack

### Core

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router) | SSR for initial load, RSC for data fetching, file-based routing |
| Language | **TypeScript** (strict mode) | Type safety for contract ABIs and app logic |
| Styling | **Tailwind CSS 4** | Utility-first, fast iteration, no component library overhead |
| Package Manager | **pnpm** | Fast, disk-efficient, strict dependency resolution |

### Blockchain

| Layer | Technology | Why |
|-------|-----------|-----|
| Client | **viem** | Type-safe EVM interactions, first-class ABI typing, lightweight |
| React hooks | **wagmi** | React hooks for viem — `useReadContract`, `useChainId`, etc. |
| Wallet (optional) | **ConnectKit** or **RainbowKit** | Only if we add wallet-connected features later |

**No ethers.js.** viem is the standard for new EVM projects — smaller bundle, better types, native BigInt.

### Visualization

| Layer | Technology | Why |
|-------|-----------|-----|
| Bin liquidity chart | **D3.js** | Full control over the bar chart — each bin is a stacked bar (reserveX + reserveY), active bin highlighted |
| Price chart | **TradingView Lightweight Charts** | Industry standard, free (Apache 2.0), renders candlesticks/lines |
| Simple charts | **Recharts** (if needed) | For basic line/area charts (TVL over time, volume) — built on D3, React-native |

### No Backend

The dashboard reads directly from RPC. With 3 pairs, there's no need for an indexer, subgraph, or custom API. All data comes from view functions:

```
LBFactory.allPairsLength()       → number of pairs
LBFactory.allPairs(i)            → pair address at index
LBPair.tokenX() / tokenY()      → token addresses
LBPair.activeId()                → current price bin
LBPair.binStep()                 → price granularity
LBPair.getBinReserves(binId)     → reserves per bin
LBPair.getTotalShares(binId)     → LP shares per bin
LBPair.getFeeParameters()        → fee config
LBPair.getSwapOut(dir, amount)   → quote
LBPair.oracle()                  → oracle module address
LBPair.compliance()              → compliance module address
OracleModule.getOracleBinId(pair)         → oracle price as bin
OracleModule.getDeviationFee(pair, binId) → current deviation fee
OracleModule.getOraclePrice(pair)         → raw Chainlink price
```

If we later need historical data (past swaps, volume over time), we add event indexing. Not now.

## Architecture

```
robin_web/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout (providers, nav)
│   │   ├── page.tsx                  # Dashboard home (all pools overview)
│   │   └── pool/
│   │       └── [address]/
│   │           └── page.tsx          # Pool detail page (bins, oracle, fees)
│   │
│   ├── components/                   # React components
│   │   ├── layout/                   # Shell, Nav, NetworkSwitcher
│   │   ├── pool/                     # PoolCard, PoolTable
│   │   ├── bins/                     # BinChart (D3), BinTable
│   │   ├── oracle/                   # OracleStatus, DeviationMeter
│   │   └── shared/                   # Badge, Skeleton, CopyAddress, TokenIcon
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAllPairs.ts            # Fetch all pairs from factory
│   │   ├── usePairState.ts           # Active bin, reserves, fee params
│   │   ├── useBinRange.ts            # Fetch reserves for bins around active
│   │   ├── useOracleData.ts          # Oracle bin, deviation fee, price
│   │   └── useTokenMetadata.ts       # Symbol, decimals, name for a token
│   │
│   ├── config/                       # Configuration (no business logic)
│   │   ├── chains.ts                 # Chain definitions (testnet, mainnet)
│   │   ├── contracts.ts              # Deployed addresses per chain
│   │   └── abis/                     # Contract ABIs (JSON, exported typed)
│   │       ├── LBFactory.ts
│   │       ├── LBPair.ts
│   │       ├── OracleModule.ts
│   │       └── ERC20.ts
│   │
│   ├── lib/                          # Pure utilities (no React, no side effects)
│   │   ├── binMath.ts                # Bin ID ↔ price conversion (mirrors Solidity BinMath)
│   │   ├── formatters.ts             # Number formatting, address truncation
│   │   └── constants.ts              # INITIAL_BIN_ID, SCALE, etc.
│   │
│   └── providers/                    # React context providers
│       └── Web3Provider.tsx          # wagmi + viem provider, chain config
│
├── public/                           # Static assets (token icons, etc.)
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

### Separation of Concerns

| Layer | Contains | Does NOT contain |
|-------|----------|-----------------|
| `config/` | Addresses, ABIs, chain definitions | Business logic, React components |
| `lib/` | Pure functions (math, formatting) | React hooks, API calls, state |
| `hooks/` | Data fetching with wagmi/viem | UI rendering, styling |
| `components/` | JSX, event handlers, styling | Direct contract calls, business logic |
| `app/` | Page composition, routing | Component implementation details |

### Network Switching

A single `config/chains.ts` file defines all network-specific values:

```ts
// config/chains.ts
import { defineChain } from 'viem'

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
})

export const robinhoodMainnet = defineChain({
  id: 0, // TBD
  name: 'Robinhood Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.chain.robinhood.com'] }, // TBD
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.chain.robinhood.com' }, // TBD
  },
})
```

A single `config/contracts.ts` maps chain ID → deployed addresses:

```ts
// config/contracts.ts
export const contracts = {
  46630: { // testnet
    factory: '0x30f8819710611d80Ce22d57947223F33C2fe8C9E',
    router: '0x7A112f26C32763B1b774899668EEfd3E0DF06447',
    compliance: '0xEFb56C901723c03DcddC8Bf38e2737d58D71c26B',
    // ...
  },
  // mainnet: same shape, different addresses
} as const
```

All hooks call `useChainId()` → look up contracts → make RPC calls. Zero business logic changes when switching networks.

## Key DLMM Concepts for the Frontend

### Bin System

- Each pair has an **active bin** (current price). ID is a `uint24` (0 to 16,777,215).
- `INITIAL_BIN_ID = 8,388,608` (2^23) represents price = 1.0.
- Price formula: `price(binId) = (1 + binStep/10000) ^ (binId - INITIAL_BIN_ID)`
- For display: scan ~20-50 bins around `activeId`, read `getBinReserves(binId)` for each.
- Bins below active hold mostly token Y. Bins above hold mostly token X. Active bin holds both.

### Bin Chart Visualization

The primary visualization: a vertical bar chart where:
- X-axis = bin IDs (price range)
- Y-axis = reserve amounts
- Each bar is stacked: bottom = reserveY (e.g., WETH), top = reserveX (e.g., AMZN)
- Active bin is highlighted (different color or border)
- Empty bins are skipped or shown as gaps

This is what Meteora shows on their pool detail pages. Build with D3 for full control.

### Price Conversion (TypeScript)

Mirror the Solidity BinMath in `lib/binMath.ts`:

```ts
const INITIAL_BIN_ID = 8_388_608n
const SCALE = 1n << 128n

export function getPriceFromBinId(binId: number, binStep: number): number {
  const exp = binId - Number(INITIAL_BIN_ID)
  return Math.pow(1 + binStep / 10000, exp)
}

export function formatBinPrice(binId: number, binStep: number, decimals = 6): string {
  return getPriceFromBinId(binId, binStep).toFixed(decimals)
}
```

### Three Bin Step Tiers

| Tier | Bin Step | Spread | Use Case |
|------|----------|--------|----------|
| Ultra-Tight | 10bp (0.1%) | Tight | Large-cap (AAPL, MSFT) |
| Standard | 50bp (0.5%) | Medium | Mid-cap (current pairs) |
| Wide | 100bp (1%) | Wide | Small-cap / volatile |

## Pages

### 1. Dashboard Home (`/`)

Overview of all pools. For each pair show:
- Token pair names + icons
- Active bin ID → human price
- Bin step tier badge
- Total reserves (sum across all bins)
- Oracle status (valid/stale/not set)
- Compliance status (enabled/disabled)
- Link to pool detail

Data: `LBFactory.allPairsLength()` → loop `allPairs(i)` → for each: `tokenX()`, `tokenY()`, `activeId()`, `binStep()`

### 2. Pool Detail (`/pool/[address]`)

Deep view into a single pair:

**Header**: Token pair, bin step, active bin, current price

**Bin Liquidity Chart** (D3): Stacked bar chart of reserves per bin. ~20-50 bins around active. Click a bin to see exact reserves and share count.

**Oracle Panel**: Oracle price vs DEX price, deviation in bins, current deviation fee (bp), feed freshness.

**Fee Parameters**: Base fee, volatility fee, protocol share, oracle deviation fee. All in basis points.

**Bin Table**: Tabular view of bins with reserves, shares, price range. Sortable.

## Implementation Plan

### Phase 1: Scaffold + Data Layer
1. Init Next.js 15 with App Router, TypeScript, Tailwind, pnpm
2. Install viem, wagmi, @tanstack/react-query
3. Create `config/chains.ts`, `config/contracts.ts`, `config/abis/`
4. Create `Web3Provider.tsx` with wagmi config (testnet as default, mainnet placeholder)
5. Create `lib/binMath.ts` and `lib/formatters.ts`
6. Create hooks: `useAllPairs`, `usePairState`, `useBinRange`, `useOracleData`, `useTokenMetadata`
7. Verify data fetching works by logging to console

### Phase 2: Dashboard Page
1. Build `PoolCard` component (displays one pair's summary)
2. Build `PoolTable` or grid layout
3. Build `NetworkSwitcher` component (testnet/mainnet toggle)
4. Wire up dashboard page with real data
5. Add loading skeletons

### Phase 3: Pool Detail Page
1. Build bin liquidity chart with D3
2. Build oracle status panel
3. Build fee parameters display
4. Build bin table (tabular view)
5. Wire up pool detail page with `useBinRange` and `useOracleData`

### Phase 4: Polish
1. Responsive layout (mobile)
2. Auto-refresh (poll every N seconds or use wagmi's `watch` mode)
3. Dark/light theme (Tailwind `dark:` classes)
4. Token icons (static assets or on-chain metadata)
5. Error states and empty states

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm type-check       # TypeScript strict check
```

## Rules

- **Read-only dashboard.** No wallet connection required for v1. No write transactions.
- **No backend.** All data from RPC view calls. Add indexing later only if needed.
- **No ethers.js.** Use viem + wagmi exclusively.
- **No component libraries** (no MUI, no Chakra, no shadcn). Tailwind + custom components. Keep the bundle small.
- **Strict TypeScript.** No `any`. ABIs are typed via viem's `Abi` type inference.
- **Network is a config concern, not a logic concern.** Hooks and components never branch on chain ID. They receive addresses from config.
