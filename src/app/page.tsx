import { PoolGrid } from '@/components/pool/PoolGrid'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Pools</h1>
        <p className="text-text-secondary text-sm mt-1">
          All DLMM liquidity pools on Robinhood Chain
        </p>
      </div>
      <PoolGrid />
    </div>
  )
}
