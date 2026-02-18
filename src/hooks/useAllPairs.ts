'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { lbFactoryAbi } from '@/config/abis/LBFactory'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export function useAllPairs() {
  const { factory } = getContracts(robinhoodTestnet.id)

  // --- DB pools (instant, persisted) ---
  const [dbPairs, setDbPairs] = useState<Address[]>([])
  const [dbLoaded, setDbLoaded] = useState(false)

  const fetchDbPools = useCallback(() => {
    fetch('/api/pools')
      .then((r) => r.json())
      .then((pools: { pair_address: string }[]) => {
        setDbPairs(pools.map((p) => p.pair_address as Address))
        setDbLoaded(true)
      })
      .catch(() => setDbLoaded(true))
  }, [])

  useEffect(() => {
    fetchDbPools()
  }, [fetchDbPools])

  // --- On-chain pools (background refresh) ---
  const { data: length, isLoading: isLoadingLength, refetch: refetchLength } = useReadContract({
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

  const chainPairs: Address[] = pairsData
    ?.filter((r) => r.status === 'success')
    .map((r) => r.result as Address) ?? []

  // Merge: DB pairs + on-chain pairs, deduplicated
  const seen = new Set<string>()
  const merged: Address[] = []
  for (const addr of [...dbPairs, ...chainPairs]) {
    const lower = addr.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      merged.push(addr)
    }
  }

  const isLoading = !dbLoaded && (isLoadingLength || isLoadingPairs)

  const refetch = useCallback(() => {
    refetchLength()
    fetchDbPools()
  }, [refetchLength, fetchDbPools])

  return {
    pairs: merged,
    isLoading,
    refetch,
  }
}
