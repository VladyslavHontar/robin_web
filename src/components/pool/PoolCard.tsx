'use client'

import Link from 'next/link'
import type { Address } from 'viem'
import { usePairState } from '@/hooks/usePairState'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { TokenIcon } from '@/components/shared/TokenIcon'
import { Badge } from '@/components/shared/Badge'
import { CopyAddress } from '@/components/shared/CopyAddress'
import { formatBinPrice, getBinStepTier } from '@/lib/binMath'
import { formatBps } from '@/lib/formatters'
import { SkeletonCard } from '@/components/shared/Skeleton'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function PoolCard({ address }: { address: Address }) {
  const { pairState, isLoading } = usePairState(address)
  const { token: tokenX } = useTokenMetadata(pairState?.tokenX)
  const { token: tokenY } = useTokenMetadata(pairState?.tokenY)

  if (isLoading || !pairState) return <SkeletonCard />

  const symbolX = tokenX?.symbol ?? '???'
  const symbolY = tokenY?.symbol ?? '???'
  const price = formatBinPrice(pairState.activeId, pairState.binStep)
  const tier = getBinStepTier(pairState.binStep)
  const hasOracle = pairState.oracleAddress !== ZERO_ADDRESS

  return (
    <Link
      href={`/pool/${address}`}
      className="block rounded-xl border border-border bg-surface-raised hover:border-accent/40 transition-colors p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          <TokenIcon symbol={symbolX} size={36} />
          <TokenIcon symbol={symbolY} size={36} />
        </div>
        <div>
          <div className="font-semibold text-text-primary">
            {symbolX} / {symbolY}
          </div>
          <CopyAddress address={address} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Price</span>
          <span className="font-mono text-text-primary">{price}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Active Bin</span>
          <span className="font-mono text-text-muted">{pairState.activeId}</span>
        </div>
        {pairState.feeParameters && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Base Fee</span>
            <span className="font-mono text-text-muted">
              {formatBps(pairState.feeParameters.baseFee)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant="accent">{tier} ({pairState.binStep}bp)</Badge>
        <Badge variant={hasOracle ? 'success' : 'default'}>
          Oracle: {hasOracle ? 'Active' : 'None'}
        </Badge>
      </div>
    </Link>
  )
}
