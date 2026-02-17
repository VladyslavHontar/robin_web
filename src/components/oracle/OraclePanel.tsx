import type { OracleData } from '@/hooks/useOracleData'
import { Badge } from '@/components/shared/Badge'
import { formatBinPrice } from '@/lib/binMath'
import { formatBps, formatTimeAgo } from '@/lib/formatters'

export function OraclePanel({
  oracleData,
  activeId,
  binStep,
  hasOracle,
}: {
  oracleData: OracleData | undefined
  activeId: number
  binStep: number
  hasOracle: boolean
}) {
  if (!hasOracle) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Oracle</h3>
        <p className="text-text-muted text-sm">No oracle configured for this pair</p>
      </div>
    )
  }

  if (!oracleData) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Oracle</h3>
        <p className="text-text-muted text-sm">Loading oracle data...</p>
      </div>
    )
  }

  const oraclePrice = formatBinPrice(oracleData.oracleBinId, binStep)
  const dexPrice = formatBinPrice(activeId, binStep)
  const binDeviation = Math.abs(activeId - oracleData.oracleBinId)
  const rawPrice = oracleData.price > 0n
    ? Number(oracleData.price) / Math.pow(10, oracleData.priceDecimals)
    : 0

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">Oracle</h3>
        <Badge variant={oracleData.isValid ? 'success' : 'error'}>
          {oracleData.isValid ? 'Valid' : 'Stale'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-text-muted">Oracle Price</div>
          <div className="font-mono text-text-primary">{oraclePrice}</div>
          <div className="text-xs text-text-muted mt-0.5">
            Bin {oracleData.oracleBinId}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">DEX Price</div>
          <div className="font-mono text-text-primary">{dexPrice}</div>
          <div className="text-xs text-text-muted mt-0.5">
            Bin {activeId}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Deviation</div>
          <div className="font-mono text-text-primary">{binDeviation} bins</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Deviation Fee</div>
          <div className="font-mono text-text-primary">
            {formatBps(oracleData.deviationFeeBps)}
          </div>
        </div>
        {rawPrice > 0 && (
          <div>
            <div className="text-xs text-text-muted">Chainlink Price</div>
            <div className="font-mono text-text-primary">${rawPrice.toFixed(2)}</div>
          </div>
        )}
        {oracleData.updatedAt > 0 && (
          <div>
            <div className="text-xs text-text-muted">Last Update</div>
            <div className="font-mono text-text-primary">
              {formatTimeAgo(oracleData.updatedAt)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
