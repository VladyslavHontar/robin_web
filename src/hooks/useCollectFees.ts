'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useCollectFees() {
  const { address: account } = useAccount()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function collectFees(pairAddress: Address, binIds: number[]) {
    if (!account) return
    writeContract({
      address: pairAddress,
      abi: lbPairAbi,
      functionName: 'collectFees',
      args: [binIds, account],
      chainId: robinhoodTestnet.id,
    })
  }

  return {
    collectFees,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    txHash,
    reset,
  }
}
