'use client'

import { use } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { usePairState } from '@/hooks/usePairState'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useBinRange } from '@/hooks/useBinRange'
import { useOracleData } from '@/hooks/useOracleData'
import { PoolHeader } from '@/components/pool/PoolHeader'
import { BinChart } from '@/components/bins/BinChart'
import { BinTable } from '@/components/bins/BinTable'
import { OraclePanel } from '@/components/oracle/OraclePanel'
import { FeeParametersPanel } from '@/components/pool/FeeParameters'
import { Skeleton } from '@/components/shared/Skeleton'
import { AddLiquidityPanel } from '@/components/liquidity/AddLiquidityPanel'

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const { address } = use(params)
  const pairAddress = address as Address

  const { pairState, isLoading: pairLoading } = usePairState(pairAddress)
  const { token: tokenX } = useTokenMetadata(pairState?.tokenX)
  const { token: tokenY } = useTokenMetadata(pairState?.tokenY)
  const { bins, isLoading: binsLoading } = useBinRange(
    pairAddress,
    pairState?.activeId,
  )
  const { oracleData, hasOracle } = useOracleData(
    pairAddress,
    pairState?.oracleAddress,
    pairState?.activeId,
  )

  if (pairLoading || !pairState) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-80 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors"
      >
        &larr; Back to Pools
      </Link>

      <PoolHeader pairState={pairState} tokenX={tokenX} tokenY={tokenY} />

      {binsLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <BinChart
          bins={bins}
          activeId={pairState.activeId}
          binStep={pairState.binStep}
          tokenXSymbol={tokenX?.symbol ?? '??'}
          tokenYSymbol={tokenY?.symbol ?? '??'}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <OraclePanel
          oracleData={oracleData}
          activeId={pairState.activeId}
          binStep={pairState.binStep}
          hasOracle={hasOracle}
        />
        <FeeParametersPanel feeParams={pairState.feeParameters} />
      </div>

      <AddLiquidityPanel
        pairState={pairState}
        tokenXSymbol={tokenX?.symbol ?? '??'}
        tokenYSymbol={tokenY?.symbol ?? '??'}
        bins={bins}
      />

      <BinTable
        bins={bins}
        activeId={pairState.activeId}
        binStep={pairState.binStep}
        tokenXSymbol={tokenX?.symbol ?? '??'}
        tokenYSymbol={tokenY?.symbol ?? '??'}
      />
    </div>
  )
}
