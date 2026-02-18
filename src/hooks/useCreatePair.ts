'use client'

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { decodeEventLog, type Address } from 'viem'
import { lbFactoryAbi } from '@/config/abis/LBFactory'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'

const INITIAL_BIN_ID = 8_388_608 // 2^23 — price = 1.0

export type CreatePairParams = {
  tokenA: Address
  tokenB: Address
  binStep: 10 | 50 | 100
  /** Initial active bin. Defaults to INITIAL_BIN_ID (price = 1.0). */
  activeId?: number
}

export function useCreatePair() {
  const { factory } = getContracts(robinhoodTestnet.id)

  const { writeContractAsync, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract()

  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  })

  // Decode the PairCreated event from the receipt to get the new pair address
  const newPairAddress: Address | undefined = (() => {
    if (!receipt) return undefined
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: lbFactoryAbi, ...log })
        if (decoded.eventName === 'PairCreated') {
          return (decoded.args as { pair: Address }).pair
        }
      } catch {
        // not a PairCreated log — skip
      }
    }
    return undefined
  })()

  async function createPair(params: CreatePairParams): Promise<Address> {
    const activeId = params.activeId ?? INITIAL_BIN_ID

    const hash = await writeContractAsync({
      address: factory,
      abi: lbFactoryAbi,
      functionName: 'createPair',
      args: [params.tokenA, params.tokenB, params.binStep, activeId],
      chainId: robinhoodTestnet.id,
    })

    return hash as unknown as Address // hash returned immediately; newPairAddress resolved after receipt
  }

  return {
    createPair,
    txHash,
    newPairAddress,
    isLoading: isWritePending || isConfirming,
    isSuccess: !!newPairAddress,
    error: writeError,
  }
}

/**
 * Compute a pair address deterministically — no chain query needed.
 * Equivalent to Solana PDA derivation: derives address purely from factory + tokens + binStep.
 */
export function useComputePairAddress(tokenA: Address | undefined, tokenB: Address | undefined, binStep: 10 | 50 | 100) {
  const { factory } = getContracts(robinhoodTestnet.id)

  return useReadContract({
    address: factory,
    abi: lbFactoryAbi,
    functionName: 'computePairAddress',
    args: tokenA && tokenB ? [tokenA, tokenB, binStep] : undefined,
    query: { enabled: !!tokenA && !!tokenB },
    chainId: robinhoodTestnet.id,
  })
}
