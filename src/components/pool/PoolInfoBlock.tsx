import type { PairState } from '@/hooks/usePairState'
import type { TokenMetadata } from '@/hooks/useTokenMetadata'
import type { OracleData } from '@/hooks/useOracleData'
import type { BinData } from '@/hooks/useBinRange'
import { BinMiniChart } from '@/components/bins/BinMiniChart'
import { Badge } from '@/components/shared/Badge'
import { TokenIcon } from '@/components/shared/TokenIcon'
import { formatBinPrice, getBinStepTier } from '@/lib/binMath'
import { formatBps, formatTimeAgo, truncateAddress } from '@/lib/formatters'
import { robinhoodTestnet } from '@/config/chains'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={`${EXPLORER}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-text-primary hover:text-accent transition-colors"
      title={address}
    >
      {truncateAddress(address, 6)}
    </a>
  )
}

/** Compact label + value row — stretches full column width */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <span className="flex items-center gap-1 font-mono text-xs text-text-primary">
        {children}
      </span>
    </div>
  )
}

/** Compact label + value pair — stretches full column width */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <span className="text-xs font-mono text-text-primary">{value}</span>
    </div>
  )
}

export function PoolInfoBlock({
  pairState,
  tokenX,
  tokenY,
  bins,
  oracleData,
  hasOracle,
}: {
  pairState: PairState
  tokenX: TokenMetadata | undefined
  tokenY: TokenMetadata | undefined
  bins: BinData[]
  oracleData: OracleData | undefined
  hasOracle: boolean
}) {
  const symbolX = tokenX?.symbol ?? '???'
  const symbolY = tokenY?.symbol ?? '???'
  const price = formatBinPrice(pairState.activeId, pairState.binStep)
  const tier = getBinStepTier(pairState.binStep)
  const feeParams = pairState.feeParameters

  const oraclePrice = oracleData ? formatBinPrice(oracleData.oracleBinId, pairState.binStep) : null
  const dexPrice = formatBinPrice(pairState.activeId, pairState.binStep)
  const binDeviation = oracleData ? Math.abs(pairState.activeId - oracleData.oracleBinId) : null
  const chainlinkPrice = oracleData && oracleData.price > 0n
    ? Number(oracleData.price) / Math.pow(10, oracleData.priceDecimals)
    : null

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">

      {/* ── Top section: mini chart | pool info | fees ── */}
      <div className="flex gap-6">

        {/* Mini chart */}
        <div className="shrink-0 w-48 h-32 rounded-lg border border-border bg-surface-overlay overflow-hidden">
          <BinMiniChart bins={bins} activeId={pairState.activeId} binStep={pairState.binStep} />
        </div>

        {/* Pool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              <TokenIcon symbol={symbolX} size={26} />
              <TokenIcon symbol={symbolY} size={26} />
            </div>
            <span className="text-base font-semibold text-text-primary">
              {symbolX} / {symbolY}
            </span>
            <Badge variant="accent">{tier} · {pairState.binStep}bp</Badge>
          </div>

          <InfoRow label="Pool"><AddressLink address={pairState.address} /></InfoRow>
          <InfoRow label={symbolX}><AddressLink address={pairState.tokenX} /></InfoRow>
          <InfoRow label={symbolY}><AddressLink address={pairState.tokenY} /></InfoRow>
          <InfoRow label="Active Bin">{pairState.activeId}</InfoRow>
          <InfoRow label="Price">{price}</InfoRow>
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-border shrink-0 self-stretch" />

        {/* Fees */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-secondary mb-3">Fees</p>
          {feeParams ? (
            <div>
              <StatRow label="Base Fee"       value={formatBps(feeParams.baseFee)} />
              <StatRow label="Max Vol Fee"    value={formatBps(feeParams.maxVolatilityFee)} />
              <StatRow label="Protocol Share" value={formatBps(feeParams.protocolShare)} />
              <StatRow label="Reduction"      value={formatBps(feeParams.reductionFactor)} />
              <StatRow label="Filter Period"  value={`${feeParams.filterPeriod}s`} />
              <StatRow label="Decay Period"   value={`${feeParams.decayPeriod}s`} />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Unavailable</p>
          )}
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-border shrink-0 self-stretch" />

        {/* Oracle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">Oracle</p>
            {hasOracle && oracleData && (
              <Badge variant={oracleData.isValid ? 'success' : 'error'}>
                {oracleData.isValid ? 'Valid' : 'Stale'}
              </Badge>
            )}
          </div>

          {!hasOracle ? (
            <p className="text-xs text-text-muted">No oracle configured</p>
          ) : !oracleData ? (
            <p className="text-xs text-text-muted">Loading…</p>
          ) : (
            <div>
              <StatRow label="Oracle Price"  value={oraclePrice ?? '—'} />
              <StatRow label="DEX Price"     value={dexPrice} />
              <StatRow label="Deviation"     value={binDeviation !== null ? `${binDeviation} bins` : '—'} />
              <StatRow label="Deviation Fee" value={formatBps(oracleData.deviationFeeBps)} />
              {chainlinkPrice !== null && (
                <StatRow label="Chainlink" value={`$${chainlinkPrice.toFixed(2)}`} />
              )}
              {oracleData.updatedAt > 0 && (
                <StatRow label="Updated" value={formatTimeAgo(oracleData.updatedAt)} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
