'use client'

import { useReadContracts } from 'wagmi'
import { erc20Abi } from '@/config/abis/ERC20'
import { knownTokens } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export type TokenMetadata = {
  address: Address
  name: string
  symbol: string
  decimals: number
}

export function useTokenMetadata(tokenAddress: Address | undefined): {
  token: TokenMetadata | undefined
  isLoading: boolean
} {
  // Check known tokens first
  const known = tokenAddress
    ? knownTokens[robinhoodTestnet.id]?.[tokenAddress]
    : undefined

  const { data, isLoading } = useReadContracts({
    contracts: tokenAddress
      ? [
          { address: tokenAddress, abi: erc20Abi, functionName: 'name', chainId: robinhoodTestnet.id },
          { address: tokenAddress, abi: erc20Abi, functionName: 'symbol', chainId: robinhoodTestnet.id },
          { address: tokenAddress, abi: erc20Abi, functionName: 'decimals', chainId: robinhoodTestnet.id },
        ]
      : [],
    query: { enabled: !!tokenAddress && !known },
  })

  if (known && tokenAddress) {
    return {
      token: { address: tokenAddress, ...known },
      isLoading: false,
    }
  }

  if (!tokenAddress || isLoading || !data) {
    return { token: undefined, isLoading }
  }

  const name = data[0]?.status === 'success' ? (data[0].result as string) : 'Unknown'
  const symbol = data[1]?.status === 'success' ? (data[1].result as string) : '???'
  const decimals = data[2]?.status === 'success' ? Number(data[2].result) : 18

  return {
    token: { address: tokenAddress, name, symbol, decimals },
    isLoading: false,
  }
}
