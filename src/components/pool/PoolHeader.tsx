import type { PairState } from '@/hooks/usePairState'
import type { TokenMetadata } from '@/hooks/useTokenMetadata'
import { TokenIcon } from '@/components/shared/TokenIcon'
import { Badge } from '@/components/shared/Badge'
import { CopyAddress } from '@/components/shared/CopyAddress'
import { formatBinPrice, getBinStepTier } from '@/lib/binMath'

export function PoolHeader({
  pairState,
  tokenX,
  tokenY,
}: {
  pairState: PairState
  tokenX: TokenMetadata | undefined
  tokenY: TokenMetadata | undefined
}) {
  const symbolX = tokenX?.symbol ?? '???'
  const symbolY = tokenY?.symbol ?? '???'
  const price = formatBinPrice(pairState.activeId, pairState.binStep)
  const tier = getBinStepTier(pairState.binStep)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          <TokenIcon symbol={symbolX} size={44} />
          <TokenIcon symbol={symbolY} size={44} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {symbolX} / {symbolY}
          </h1>
          <CopyAddress address={pairState.address} chars={6} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="accent">{tier} ({pairState.binStep}bp)</Badge>
        <div className="text-right">
          <div className="text-xs text-text-muted">Current Price</div>
          <div className="font-mono text-lg text-text-primary">{price}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">Active Bin</div>
          <div className="font-mono text-text-secondary">{pairState.activeId}</div>
        </div>
      </div>
    </div>
  )
}
