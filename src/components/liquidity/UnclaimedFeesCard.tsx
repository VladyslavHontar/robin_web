'use client'

import { useEffect } from 'react'
import { formatEther } from 'viem'
import { useUnclaimedFees } from '@/hooks/useUnclaimedFees'
import { useCollectFees } from '@/hooks/useCollectFees'
import type { PairState } from '@/hooks/usePairState'
import type { UserPosition } from '@/hooks/useUserPositions'

function fmtFee(value: bigint): string {
  if (value === 0n) return '0'
  const n = Number(formatEther(value))
  if (n < 0.000001) return '<0.000001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  positions: UserPosition[]
}

/**
 * Compact inline fee strip — designed to sit on the same row as the mode toggle.
 * Invisible when there are no unclaimed fees or no positions.
 */
export function UnclaimedFeesCard({ pairState, tokenXSymbol, tokenYSymbol, positions }: Props) {
  const { feeX, feeY, isLoading, refetch } = useUnclaimedFees(pairState.address, positions)
  const { collectFees, isPending, isSuccess, error, reset } = useCollectFees()

  useEffect(() => {
    if (isSuccess) { refetch(); reset() }
  }, [isSuccess, refetch, reset])

  if (positions.length === 0) return null
  const hasFees = feeX > 0n || feeY > 0n

  const binIds = positions.map((p) => p.binId)

  return (
    <div className="flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-2.5 py-1.5">
      {/* Fee amounts */}
      <span className="text-[10px] text-text-muted uppercase tracking-wide">Fees</span>
      <div className="flex items-center gap-2 text-[11px] font-mono">
        {isLoading ? (
          <>
            <div className="h-2.5 w-12 rounded bg-accent/10 animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-accent/10 animate-pulse" />
          </>
        ) : (
          <>
            <span className={feeX > 0n ? 'text-text-primary' : 'text-text-muted'}>
              {fmtFee(feeX)} <span className="text-text-muted">{tokenXSymbol}</span>
            </span>
            <span className="text-border">·</span>
            <span className={feeY > 0n ? 'text-text-primary' : 'text-text-muted'}>
              {fmtFee(feeY)} <span className="text-text-muted">{tokenYSymbol}</span>
            </span>
          </>
        )}
      </div>

      {/* Collect button — only active when there are fees */}
      <button
        onClick={() => collectFees(pairState.address, binIds)}
        disabled={isPending || isLoading || !hasFees}
        className="text-[10px] font-semibold text-accent hover:text-accent-hover transition-colors disabled:opacity-30 disabled:cursor-default"
        title={error ? error.message : hasFees ? 'Collect fees' : 'No fees to collect'}
      >
        {isPending ? '…' : 'Collect'}
      </button>
    </div>
  )
}
