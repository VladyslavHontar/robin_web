'use client'

import { useReadContract } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

/**
 * Live swap quote by calling LBPair.getSwapOut.
 * The returned amountOut and fees already account for all fee components
 * (base fee, volatility fee, oracle deviation fee, and the 1.5× off-market-hours multiplier).
 */
export function useSwapQuote(
  pairAddress: Address,
  swapForY: boolean,
  amountIn: bigint,
) {
  const { data, isLoading, isError } = useReadContract({
    address: pairAddress,
    abi: lbPairAbi,
    functionName: 'getSwapOut',
    args: [swapForY, amountIn],
    chainId: robinhoodTestnet.id,
    query: { enabled: amountIn > 0n },
  })

  const amountOut: bigint = data ? (data as [bigint, bigint])[0] : 0n
  const fees: bigint = data ? (data as [bigint, bigint])[1] : 0n

  // Effective fee rate as basis points (fees / amountIn × 10000)
  const feeRateBps =
    amountIn > 0n && fees > 0n ? Number((fees * 10_000n) / amountIn) : 0

  return { amountOut, fees, feeRateBps, isLoading, isError }
}
