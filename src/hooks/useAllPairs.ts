'use client'

import { useReadContract, useReadContracts } from 'wagmi'
import { lbFactoryAbi } from '@/config/abis/LBFactory'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useAllPairs() {
  const { factory } = getContracts(robinhoodTestnet.id)

  const { data: length, isLoading: isLoadingLength } = useReadContract({
    address: factory,
    abi: lbFactoryAbi,
    functionName: 'allPairsLength',
    chainId: robinhoodTestnet.id,
  })

  const pairCount = length ? Number(length) : 0

  const { data: pairsData, isLoading: isLoadingPairs } = useReadContracts({
    contracts: Array.from({ length: pairCount }, (_, i) => ({
      address: factory,
      abi: lbFactoryAbi,
      functionName: 'allPairs' as const,
      args: [BigInt(i)] as const,
      chainId: robinhoodTestnet.id,
    })),
    query: { enabled: pairCount > 0 },
  })

  const pairs: Address[] = pairsData
    ?.filter((r) => r.status === 'success')
    .map((r) => r.result as Address) ?? []

  return {
    pairs,
    isLoading: isLoadingLength || isLoadingPairs,
  }
}
