'use client'

import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from '@/config/abis/ERC20'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useTokenBalance(tokenAddress: Address | undefined) {
  const { address: account } = useAccount()

  const { data: balance, isLoading } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!tokenAddress && !!account },
  })

  return {
    balance: balance as bigint | undefined,
    isLoading,
  }
}
