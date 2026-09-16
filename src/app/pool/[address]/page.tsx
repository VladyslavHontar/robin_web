'use client'

import { use } from 'react'
import Link from 'next/link'
import type { Address } from 'viem'
import { usePairState } from '@/hooks/usePairState'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useBinRange } from '@/hooks/useBinRange'
import { useOracleData } from '@/hooks/useOracleData'
import { PoolInfoBlock } from '@/components/pool/PoolInfoBlock'
import { BinTable } from '@/components/bins/BinTable'
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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-48 w-full" />
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

      {binsLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <PoolInfoBlock
          pairState={pairState}
          tokenX={tokenX}
          tokenY={tokenY}
          bins={bins}
          oracleData={oracleData}
          hasOracle={hasOracle}
        />
      )}

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
