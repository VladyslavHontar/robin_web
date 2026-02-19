import { defineChain } from 'viem'

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
})

// Registry of all supported chains — used by the RPC proxy to look up URLs.
// !TODO add robinhoodMainnet here once its RPC is known.
export const supportedChains = [robinhoodTestnet] as const
