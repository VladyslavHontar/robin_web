'use client'

import { useState } from 'react'
import { type Address } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useAllPairs } from '@/hooks/useAllPairs'
import { PoolCard } from './PoolCard'
import { CreatePoolModal } from './CreatePoolModal'
import { SkeletonCard } from '@/components/shared/Skeleton'

export function PoolGrid() {
  const { pairs, isLoading, refetch } = useAllPairs()
  const [showCreate, setShowCreate] = useState(false)

  function handleCreated(newPair: Address) {
    setShowCreate(false)
    refetch()          // reload pair list to include the new pool immediately
  }

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">
          Pools {!isLoading && <span className="text-text-muted text-base font-normal">({pairs.length})</span>}
        </h2>
        <motion.button
          onClick={() => setShowCreate(true)}
          whileTap={{ scale: 0.97 }}
          className="px-4 py-2 text-sm rounded-lg bg-accent text-white font-medium
                     hover:bg-accent-hover transition-colors"
        >
          + Create Pool
        </motion.button>
      </div>

      {/* Pool list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : pairs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-secondary text-lg">No pools found</p>
          <p className="text-text-muted text-sm mt-1">
            Create the first pool using the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pairs.map((address) => (
            <PoolCard key={address} address={address} />
          ))}
        </div>
      )}

      {/* Create pool modal */}
      <AnimatePresence>
        {showCreate && (
          <CreatePoolModal
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </>
  )
}
