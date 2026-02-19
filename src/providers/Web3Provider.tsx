'use client'

import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http, createConnector } from 'wagmi'
import { injected } from 'wagmi/connectors'
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
  type Wallet,
} from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets'
import type { EIP1193Provider } from 'viem'
import { robinhoodTestnet } from '@/config/chains'

// Inline SVG icon — Robinhood brand green with bold white R.
const ROBINHOOD_ICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#00C805"/><text x="50" y="72" font-family="Arial Black,Arial" font-size="64" font-weight="900" text-anchor="middle" fill="white">R</text></svg>`,
)}`

// ─── Robinhood Wallet connector ──────────────────────────────────────────────
// In RainbowKit v2 wallets are creator functions (like metaMaskWallet).
// Detection order:
//   1. window.robinhoodWallet.ethereum  (dedicated namespace)
//   2. window.ethereum with isRobinhood flag  (fallback when it's the active injected wallet)
// EIP-6963 auto-discovery also fires if neither is found and the extension is active.

function robinhoodWallet(): Wallet {
  return {
    id: 'robinhoodWallet',
    name: 'Robinhood Wallet',
    iconBackground: '#00C805',
    iconUrl: ROBINHOOD_ICON,
    // No browser extension exists yet — always show the "Get" button that
    // directs users to the Robinhood web3 wallet landing page.
    // When an official extension ships, remove this line and the connector
    // below will auto-detect it via window.robinhoodWallet or isRobinhood flag.
    installed: false,
    downloadUrls: {
      chrome: 'https://robinhood.com/web3-wallet/',
      ios: 'https://robinhood.com/web3-wallet/',
      android: 'https://robinhood.com/web3-wallet/',
      browserExtension: 'https://robinhood.com/web3-wallet/',
      qrCode: 'https://robinhood.com/web3-wallet/',
    },
    createConnector: (walletDetails) =>
      createConnector((config) => ({
        ...injected({
          target() {
            if (typeof window === 'undefined') return undefined
            const w = window as unknown as Record<string, unknown>
            const rh = w['robinhoodWallet'] as { ethereum?: EIP1193Provider } | undefined
            if (rh?.ethereum) {
              return { id: 'robinhoodWallet', name: 'Robinhood Wallet', provider: rh.ethereum }
            }
            const eth = window.ethereum as (EIP1193Provider & { isRobinhood?: boolean }) | undefined
            if (eth?.isRobinhood) {
              return { id: 'robinhoodWallet', name: 'Robinhood Wallet', provider: eth }
            }
            return undefined
          },
        })(config),
        ...walletDetails,
      })),
  }
}

// ─── Wallet list ─────────────────────────────────────────────────────────────

const PROJECT_ID = 'robin-dlmm-dashboard'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Robinhood',
      wallets: [robinhoodWallet],
    },
    {
      groupName: 'Other wallets',
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet, injectedWallet],
    },
  ],
  { appName: 'Robin DLMM Dashboard', projectId: PROJECT_ID },
)

// ─── Wagmi + query config ─────────────────────────────────────────────────────

const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors,
  transports: { [robinhoodTestnet.id]: http() },
  ssr: true,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10_000,
      staleTime: 5_000,
    },
  },
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#0DAB76',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
