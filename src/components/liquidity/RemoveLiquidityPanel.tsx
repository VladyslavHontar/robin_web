'use client'

import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserPositions } from '@/hooks/useUserPositions'
import { useRemoveLiquidity } from '@/hooks/useRemoveLiquidity'
import { robinhoodTestnet } from '@/config/chains'
import type { PairState } from '@/hooks/usePairState'
import type { BinData } from '@/hooks/useBinRange'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

const slideAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
}

const PRESETS = [25, 50, 75, 100] as const

function fmt(value: bigint): string {
  const n = Number(formatEther(value))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  bins: BinData[]
}

export function RemoveLiquidityPanel({ pairState, tokenXSymbol, tokenYSymbol, bins }: Props) {
  const [percentage, setPercentage] = useState<number>(100)

  const { positions, totalEstimatedX, totalEstimatedY, isLoading } = useUserPositions(
    pairState.address,
    bins,
  )

  const { removeLiquidity, isPending, isSuccess, error, txHash, reset } = useRemoveLiquidity()

  // Reset percentage after success
  useEffect(() => {
    if (isSuccess) setPercentage(100)
  }, [isSuccess])

  const hasPositions = positions.length > 0

  const withdrawX = hasPositions ? (totalEstimatedX * BigInt(percentage)) / 100n : 0n
  const withdrawY = hasPositions ? (totalEstimatedY * BigInt(percentage)) / 100n : 0n

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading positions…</p>
  }

  if (!hasPositions) {
    return <p className="text-sm text-text-muted">You have no liquidity in this pool.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Position summary */}
      <div className="rounded-lg border border-border bg-surface-overlay p-3 space-y-1">
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Your position</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{tokenXSymbol}</span>
          <span className="text-xs font-mono text-text-primary">{fmt(totalEstimatedX)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{tokenYSymbol}</span>
          <span className="text-xs font-mono text-text-primary">{fmt(totalEstimatedY)}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-text-muted">Bins</span>
          <span className="text-xs font-mono text-text-primary">{positions.length}</span>
        </div>
      </div>

      {/* Percentage presets */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Amount to remove</p>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPercentage(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                percentage === p
                  ? 'bg-accent text-white'
                  : 'border border-border text-text-muted hover:text-text-secondary hover:border-accent/40'
              }`}
            >
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated receive */}
      <div className="rounded-lg border border-border bg-surface-overlay p-3 space-y-1">
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">You will receive</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{tokenXSymbol}</span>
          <span className="text-xs font-mono text-text-primary">{fmt(withdrawX)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{tokenYSymbol}</span>
          <span className="text-xs font-mono text-text-primary">{fmt(withdrawY)}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => removeLiquidity({ pairAddress: pairState.address, positions, percentage })}
        disabled={isPending}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-error text-white hover:bg-error/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Removing…' : `Remove ${percentage === 100 ? 'All' : `${percentage}%`} Liquidity`}
      </button>

      {/* Status */}
      <AnimatePresence>
        {isSuccess && txHash && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs text-success">Liquidity removed successfully!</p>
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View transaction
              </a>
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="p-2.5 rounded-lg bg-error/10 border border-error/20">
              <p className="text-xs text-error">{error.message.slice(0, 200)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
