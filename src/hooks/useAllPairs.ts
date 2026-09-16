'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Address } from 'viem'

export function useAllPairs() {
  const [pairs, setPairs] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchDbPools = useCallback(() => {
    setIsLoading(true)
    fetch('/api/pools')
      .then((r) => r.json())
      .then((pools: { pair_address: string }[]) => {
        setPairs(pools.map((p) => p.pair_address as Address))
      })
      .catch(() => setPairs([]))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    fetchDbPools()
  }, [fetchDbPools])

  return { pairs, isLoading, refetch: fetchDbPools }
}
