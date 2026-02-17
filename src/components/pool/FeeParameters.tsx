import type { FeeParameters as FeeParams } from '@/hooks/usePairState'
import { formatBps } from '@/lib/formatters'

export function FeeParametersPanel({ feeParams }: { feeParams: FeeParams | undefined }) {
  if (!feeParams) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Fee Parameters</h3>
        <p className="text-text-muted text-sm">Unable to load fee parameters</p>
      </div>
    )
  }

  const items = [
    { label: 'Base Fee', value: formatBps(feeParams.baseFee) },
    { label: 'Max Volatility Fee', value: formatBps(feeParams.maxVolatilityFee) },
    { label: 'Protocol Share', value: formatBps(feeParams.protocolShare) },
    { label: 'Volatility Reference', value: `Bin ${feeParams.volatilityReference}` },
    { label: 'Filter Period', value: `${feeParams.filterPeriod}s` },
    { label: 'Decay Period', value: `${feeParams.decayPeriod}s` },
    { label: 'Reduction Factor', value: formatBps(feeParams.reductionFactor) },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">Fee Parameters</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{item.label}</span>
            <span className="font-mono text-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
