'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi } from '@/config/abis/ERC20'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useTokenApproval(tokenAddress: Address | undefined, spender: Address | undefined) {
  const { address: account } = useAccount()

  const { data: allowance, isLoading: isLoadingAllowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account && spender ? [account, spender] : undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: !!tokenAddress && !!account && !!spender },
  })

  const { writeContract, data: txHash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Refetch allowance after approval confirms
  if (isSuccess) {
    refetch()
  }

  function approve(amount: bigint) {
    if (!tokenAddress || !spender) return
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
      chainId: robinhoodTestnet.id,
    })
  }

  return {
    allowance: allowance as bigint | undefined,
    isLoadingAllowance,
    needsApproval: (amount: bigint) => {
      if (!allowance) return true
      return (allowance as bigint) < amount
    },
    approve,
    isPending: isPending || isConfirming,
  }
}
