'use client'

import { useAccount, useReadContract } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'
import type { UserPosition } from './useUserPositions'

/**
 * Reads unclaimed LP fees for the connected wallet across all provided positions.
 * Calls getUnclaimedFees(account, binIds) once — the contract aggregates all bins.
 */
export function useUnclaimedFees(pairAddress: Address, positions: UserPosition[]) {
  const { address: account } = useAccount()
  const binIds = positions.map((p) => p.binId)

  const { data, isLoading, refetch } = useReadContract({
    address: pairAddress,
    abi: lbPairAbi,
    functionName: 'getUnclaimedFees',
    args: [account!, binIds as number[]],
    chainId: robinhoodTestnet.id,
    query: { enabled: !!account && binIds.length > 0 },
  })

  const feeX: bigint = data ? (data as [bigint, bigint])[0] : 0n
  const feeY: bigint = data ? (data as [bigint, bigint])[1] : 0n

  return { feeX, feeY, isLoading, refetch }
}
