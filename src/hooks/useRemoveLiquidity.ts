'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'
import type { UserPosition } from './useUserPositions'

type RemoveLiquidityParams = {
  pairAddress: Address
  positions: UserPosition[]
  /** Percentage of shares to remove: 1–100 */
  percentage: number
}

export function useRemoveLiquidity() {
  const { address: account } = useAccount()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function removeLiquidity(params: RemoveLiquidityParams) {
    if (!account) return

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    const factor = BigInt(params.percentage)

    const binIds = params.positions.map((p) => p.binId)
    const shares = params.positions.map((p) => (p.shares * factor) / 100n)

    writeContract({
      address: params.pairAddress,
      abi: lbPairAbi,
      functionName: 'burn',
      args: [
        {
          binIds,
          shares,
          minAmountX: 0n,
          minAmountY: 0n,
          deadline,
          to: account,
        },
      ],
      chainId: robinhoodTestnet.id,
    })
  }

  return {
    removeLiquidity,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    txHash,
    reset,
  }
}
