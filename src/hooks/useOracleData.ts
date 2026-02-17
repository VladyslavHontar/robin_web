'use client'

import { useReadContracts } from 'wagmi'
import { oracleModuleAbi } from '@/config/abis/OracleModule'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export type OracleData = {
  oracleBinId: number
  isValid: boolean
  price: bigint
  priceDecimals: number
  updatedAt: number
  deviationFeeBps: number
}

export function useOracleData(
  pairAddress: Address | undefined,
  oracleAddress: Address | undefined,
  activeId: number | undefined,
) {
  const enabled = !!pairAddress && !!oracleAddress && oracleAddress !== ZERO_ADDRESS && activeId !== undefined

  const { data, isLoading } = useReadContracts({
    contracts: enabled
      ? [
          {
            address: oracleAddress!,
            abi: oracleModuleAbi,
            functionName: 'getOracleBinId',
            args: [pairAddress!],
            chainId: robinhoodTestnet.id,
          },
          {
            address: oracleAddress!,
            abi: oracleModuleAbi,
            functionName: 'getOraclePrice',
            args: [pairAddress!],
            chainId: robinhoodTestnet.id,
          },
          {
            address: oracleAddress!,
            abi: oracleModuleAbi,
            functionName: 'getDeviationFee',
            args: [pairAddress!, activeId!],
            chainId: robinhoodTestnet.id,
          },
        ]
      : [],
    query: { enabled },
  })

  if (!enabled || isLoading || !data) {
    return { oracleData: undefined, isLoading, hasOracle: enabled }
  }

  let oracleBinId = 0
  let isValid = false
  if (data[0]?.status === 'success') {
    const result = data[0].result as [number, boolean]
    oracleBinId = Number(result[0])
    isValid = result[1]
  }

  let price = 0n
  let priceDecimals = 8
  let updatedAt = 0
  if (data[1]?.status === 'success') {
    const result = data[1].result as [bigint, number, bigint]
    price = result[0]
    priceDecimals = Number(result[1])
    updatedAt = Number(result[2])
  }

  let deviationFeeBps = 0
  if (data[2]?.status === 'success') {
    deviationFeeBps = Number(data[2].result)
  }

  const oracleData: OracleData = {
    oracleBinId,
    isValid,
    price,
    priceDecimals,
    updatedAt,
    deviationFeeBps,
  }

  return { oracleData, isLoading, hasOracle: true }
}
