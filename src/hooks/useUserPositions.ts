'use client'

import { useReadContracts, useAccount } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'
import type { BinData } from './useBinRange'

export type UserPosition = {
  binId: number
  shares: bigint
  totalShares: bigint
  /** Estimated token amounts based on share ratio */
  estimatedX: bigint
  estimatedY: bigint
}

/**
 * Reads the connected user's LP share balance for every bin in the provided range.
 * Returns only bins where the user holds shares > 0.
 */
export function useUserPositions(pairAddress: Address, bins: BinData[]) {
  const { address: account } = useAccount()

  // Batch-read both balanceOf and getTotalShares for each bin in one round-trip
  const { data, isLoading, refetch } = useReadContracts({
    contracts: bins.flatMap((bin) => [
      {
        address: pairAddress,
        abi: lbPairAbi,
        functionName: 'balanceOf' as const,
        args: [account!, bin.binId] as const,
        chainId: robinhoodTestnet.id,
      },
      {
        address: pairAddress,
        abi: lbPairAbi,
        functionName: 'getTotalShares' as const,
        args: [bin.binId] as const,
        chainId: robinhoodTestnet.id,
      },
    ]),
    query: { enabled: !!account && bins.length > 0 },
  })

  const positions: UserPosition[] = []

  if (data) {
    for (let i = 0; i < bins.length; i++) {
      const balResult = data[i * 2]
      const totResult = data[i * 2 + 1]
      if (balResult?.status !== 'success' || totResult?.status !== 'success') continue

      const shares      = balResult.result as bigint
      const totalShares = totResult.result as bigint
      if (shares === 0n) continue

      const bin = bins[i]
      const estimatedX = totalShares > 0n ? (shares * bin.reserveX) / totalShares : 0n
      const estimatedY = totalShares > 0n ? (shares * bin.reserveY) / totalShares : 0n

      positions.push({ binId: bin.binId, shares, totalShares, estimatedX, estimatedY })
    }
  }

  const totalEstimatedX = positions.reduce((s, p) => s + p.estimatedX, 0n)
  const totalEstimatedY = positions.reduce((s, p) => s + p.estimatedY, 0n)

  return { positions, totalEstimatedX, totalEstimatedY, isLoading, refetch }
}
