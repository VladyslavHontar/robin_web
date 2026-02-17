'use client'

import { useAllPairs } from '@/hooks/useAllPairs'
import { PoolCard } from './PoolCard'
import { SkeletonCard } from '@/components/shared/Skeleton'

export function PoolGrid() {
  const { pairs, isLoading } = useAllPairs()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (pairs.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary text-lg">No pools found</p>
        <p className="text-text-muted text-sm mt-1">
          Check that the factory contract is deployed on the current network.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {pairs.map((address) => (
        <PoolCard key={address} address={address} />
      ))}
    </div>
  )
}
