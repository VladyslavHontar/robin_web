'use client'

import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from '@/config/abis/ERC20'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useTokenBalance(tokenAddress: Address | undefined) {
  const { address: account } = useAccount()

  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!tokenAddress && !!account },
  })

  const { data: decimals, isLoading: decimalsLoading } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: robinhoodTestnet.id,
    query: { enabled: !!tokenAddress },
  })

  return {
    balance: balance as bigint | undefined,
    decimals: decimals as number | undefined,
    isLoading: balanceLoading || decimalsLoading,
  }
}
