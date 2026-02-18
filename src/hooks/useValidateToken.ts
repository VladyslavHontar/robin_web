'use client'

import { useReadContracts } from 'wagmi'
import { erc20Abi } from '@/config/abis/ERC20'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'
import { isAddress } from 'viem'

type TokenValidation = {
  isValid: boolean
  isLoading: boolean
  symbol?: string
  decimals?: number
  error?: string
}

/**
 * Validates that an address is a real ERC20 token by reading symbol() and decimals().
 * If either call fails, the address is not a valid token.
 */
export function useValidateToken(address: string): TokenValidation {
  const valid = isAddress(address)

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: address as Address,
        abi: erc20Abi,
        functionName: 'symbol',
        chainId: robinhoodTestnet.id,
      },
      {
        address: address as Address,
        abi: erc20Abi,
        functionName: 'decimals',
        chainId: robinhoodTestnet.id,
      },
    ],
    query: { enabled: valid },
  })

  if (!valid) {
    return { isValid: false, isLoading: false }
  }

  if (isLoading) {
    return { isValid: false, isLoading: true }
  }

  if (!data) {
    return { isValid: false, isLoading: false }
  }

  const symbolResult = data[0]
  const decimalsResult = data[1]

  if (symbolResult.status !== 'success' || decimalsResult.status !== 'success') {
    return {
      isValid: false,
      isLoading: false,
      error: 'Address is not a valid ERC20 token',
    }
  }

  return {
    isValid: true,
    isLoading: false,
    symbol: symbolResult.result as string,
    decimals: Number(decimalsResult.result),
  }
}
