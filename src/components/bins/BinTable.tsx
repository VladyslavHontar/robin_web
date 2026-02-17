import type { BinData } from '@/hooks/useBinRange'
import { formatBinPrice } from '@/lib/binMath'
import { formatWei } from '@/lib/formatters'

export function BinTable({
  bins,
  activeId,
  binStep,
}: {
  bins: BinData[]
  activeId: number
  binStep: number
}) {
  if (bins.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-8 text-center text-text-muted">
        No bins with liquidity
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-text-secondary">
          Bin Details ({bins.length} bins with liquidity)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs">
              <th className="text-left px-4 py-2 font-medium">Bin ID</th>
              <th className="text-right px-4 py-2 font-medium">Price</th>
              <th className="text-right px-4 py-2 font-medium">Reserve X</th>
              <th className="text-right px-4 py-2 font-medium">Reserve Y</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((bin) => (
              <tr
                key={bin.binId}
                className={`border-b border-border/50 hover:bg-surface-overlay/50 transition-colors ${
                  bin.binId === activeId ? 'bg-active-bin/5' : ''
                }`}
              >
                <td className="px-4 py-2 font-mono text-text-primary">
                  {bin.binId}
                  {bin.binId === activeId && (
                    <span className="ml-2 text-active-bin text-xs">active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono text-text-secondary">
                  {formatBinPrice(bin.binId, binStep)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-reserve-x">
                  {formatWei(bin.reserveX)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-reserve-y">
                  {formatWei(bin.reserveY)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
