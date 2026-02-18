'use client'

import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useRemoveLiquidity } from '@/hooks/useRemoveLiquidity'
import { robinhoodTestnet } from '@/config/chains'
import type { PairState } from '@/hooks/usePairState'
import type { UserPosition } from '@/hooks/useUserPositions'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

const slideAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
}

function fmt(value: bigint): string {
  const n = Number(formatEther(value))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function PercentageSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => { setDraft(String(value)) }, [value])

  function commit(raw: string) {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n)) { setDraft(String(value)); return }
    const clamped = Math.max(1, Math.min(100, n))
    setDraft(String(clamped))
    onChange(clamped)
  }

  // Fraction 0–1 used for the track gradient
  const pct = ((value - 1) / 99) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-text-muted uppercase tracking-wide">Amount to remove</p>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface px-2 py-1">
          <input
            type="number"
            min={1}
            max={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
            className="w-10 text-right text-xs font-mono bg-transparent text-text-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-text-muted">%</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => { const v = Number(e.target.value); setDraft(String(v)); onChange(v) }}
        style={{
          background: `linear-gradient(to right, #0DAB76 0%, #0DAB76 ${pct}%, #0B5D1E ${pct}%, #0B5D1E 100%)`,
        }}
        className={[
          'w-full h-1 rounded-full appearance-none cursor-pointer outline-none',
          // webkit thumb
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:w-[14px]',
          '[&::-webkit-slider-thumb]:h-[14px]',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-[#0DAB76]',
          '[&::-webkit-slider-thumb]:border-2',
          '[&::-webkit-slider-thumb]:border-[#051a0a]',
          '[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_#0DAB76]',
          '[&::-webkit-slider-thumb]:cursor-grab',
          '[&::-webkit-slider-thumb:active]:cursor-grabbing',
          '[&::-webkit-slider-thumb:active]:shadow-[0_0_0_3px_rgba(13,171,118,0.35)]',
          '[&::-webkit-slider-thumb:hover]:shadow-[0_0_0_3px_rgba(13,171,118,0.25)]',
          // firefox thumb
          '[&::-moz-range-thumb]:w-[14px]',
          '[&::-moz-range-thumb]:h-[14px]',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-[#0DAB76]',
          '[&::-moz-range-thumb]:border-2',
          '[&::-moz-range-thumb]:border-[#051a0a]',
          '[&::-moz-range-thumb]:cursor-grab',
        ].join(' ')}
      />
    </div>
  )
}

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  /** Positions fetched by parent (for overlay + reuse) */
  positions: UserPosition[]
  isPositionsLoading: boolean
  /** Controlled percentage (lifted to parent for chart overlay) */
  percentage: number
  onPercentageChange: (p: number) => void
}

export function RemoveLiquidityPanel({
  pairState,
  tokenXSymbol,
  tokenYSymbol,
  positions,
  isPositionsLoading,
  percentage,
  onPercentageChange,
}: Props) {
  const { removeLiquidity, isPending, isSuccess, error, txHash, reset } = useRemoveLiquidity()

  // Reset to 100% after success
  useEffect(() => {
    if (isSuccess) onPercentageChange(100)
  }, [isSuccess, onPercentageChange])

  const hasPositions = positions.length > 0

  const totalEstimatedX = positions.reduce((s, p) => s + p.estimatedX, 0n)
  const totalEstimatedY = positions.reduce((s, p) => s + p.estimatedY, 0n)
  const withdrawX = hasPositions ? (totalEstimatedX * BigInt(percentage)) / 100n : 0n
  const withdrawY = hasPositions ? (totalEstimatedY * BigInt(percentage)) / 100n : 0n

  if (isPositionsLoading) {
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

      {/* Percentage slider */}
      <PercentageSlider value={percentage} onChange={onPercentageChange} />

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
