'use client'

import { useReadContracts } from 'wagmi'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import type { Address } from 'viem'

export type FeeParameters = {
  baseFee: number
  protocolShare: number
  maxVolatilityFee: number
  volatilityReference: number
  filterPeriod: number
  decayPeriod: number
  reductionFactor: number
}

export type PairState = {
  address: Address
  tokenX: Address
  tokenY: Address
  binStep: number
  activeId: number
  oracleAddress: Address
  complianceAddress: Address
  feeParameters: FeeParameters | undefined
}

export function usePairState(pairAddress: Address | undefined) {
  const { data, isLoading } = useReadContracts({
    contracts: pairAddress
      ? [
          { address: pairAddress, abi: lbPairAbi, functionName: 'tokenX', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'tokenY', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'binStep', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'activeId', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'oracle', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'compliance', chainId: robinhoodTestnet.id },
          { address: pairAddress, abi: lbPairAbi, functionName: 'getFeeParameters', chainId: robinhoodTestnet.id },
        ]
      : [],
    query: { enabled: !!pairAddress },
  })

  if (!pairAddress || isLoading || !data) {
    return { pairState: undefined, isLoading }
  }

  const tokenX = data[0]?.status === 'success' ? (data[0].result as Address) : undefined
  const tokenY = data[1]?.status === 'success' ? (data[1].result as Address) : undefined
  const binStep = data[2]?.status === 'success' ? Number(data[2].result) : undefined
  const activeId = data[3]?.status === 'success' ? Number(data[3].result) : undefined
  const oracleAddress = data[4]?.status === 'success' ? (data[4].result as Address) : ('0x0000000000000000000000000000000000000000' as Address)
  const complianceAddress = data[5]?.status === 'success' ? (data[5].result as Address) : ('0x0000000000000000000000000000000000000000' as Address)

  let feeParameters: FeeParameters | undefined
  if (data[6]?.status === 'success') {
    const fp = data[6].result as {
      baseFee: number
      protocolShare: number
      maxVolatilityFee: number
      volatilityReference: number
      filterPeriod: number
      decayPeriod: number
      reductionFactor: number
    }
    feeParameters = {
      baseFee: Number(fp.baseFee),
      protocolShare: Number(fp.protocolShare),
      maxVolatilityFee: Number(fp.maxVolatilityFee),
      volatilityReference: Number(fp.volatilityReference),
      filterPeriod: Number(fp.filterPeriod),
      decayPeriod: Number(fp.decayPeriod),
      reductionFactor: Number(fp.reductionFactor),
    }
  }

  if (!tokenX || !tokenY || binStep === undefined || activeId === undefined) {
    return { pairState: undefined, isLoading }
  }

  const pairState: PairState = {
    address: pairAddress,
    tokenX,
    tokenY,
    binStep,
    activeId,
    oracleAddress,
    complianceAddress,
    feeParameters,
  }

  return { pairState, isLoading }
}
