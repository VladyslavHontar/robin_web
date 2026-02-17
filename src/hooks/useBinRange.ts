'use client'

import { useReadContracts } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export type BinData = {
  binId: number
  reserveX: bigint
  reserveY: bigint
}

export function useBinRange(
  pairAddress: Address | undefined,
  activeId: number | undefined,
  range = 25,
) {
  const enabled = !!pairAddress && activeId !== undefined

  const binIds: number[] = []
  if (enabled) {
    for (let i = activeId - range; i <= activeId + range; i++) {
      if (i >= 0 && i <= 16_777_215) {
        binIds.push(i)
      }
    }
  }

  const { data, isLoading } = useReadContracts({
    contracts: binIds.map((binId) => ({
      address: pairAddress!,
      abi: lbPairAbi,
      functionName: 'getBinReserves' as const,
      args: [binId] as const,
      chainId: robinhoodTestnet.id,
    })),
    query: { enabled },
  })

  const bins: BinData[] = []
  if (data) {
    for (let i = 0; i < binIds.length; i++) {
      const result = data[i]
      if (result?.status === 'success') {
        const [reserveX, reserveY] = result.result as [bigint, bigint]
        if (reserveX > 0n || reserveY > 0n) {
          bins.push({ binId: binIds[i], reserveX, reserveY })
        }
      }
    }
  }

  return { bins, isLoading, allBinIds: binIds }
}
