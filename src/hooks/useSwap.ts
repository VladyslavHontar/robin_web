'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { lbRouterAbi } from '@/config/abis/LBRouter'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import { useTxToast } from './useTxToast'
import type { Address } from 'viem'

type SwapParams = {
  pair: Address
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  /** amountOut × (10000 − slippageBps) / 10000n */
  minAmountOut: bigint
}

export function useSwap() {
  const { address: account } = useAccount()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  useTxToast({ label: 'Swap', txHash, isSuccess, error })

  function executeSwap(params: SwapParams) {
    if (!account) return

    const contracts = getContracts(robinhoodTestnet.id)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)

    writeContract({
      address: contracts.router as Address,
      abi: lbRouterAbi,
      functionName: 'swapOnPair',
      args: [
        params.pair,
        params.tokenIn,
        params.tokenOut,
        params.amountIn,
        params.minAmountOut,
        account,
        deadline,
      ],
      chainId: robinhoodTestnet.id,
    })
  }

  return {
    executeSwap,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    txHash,
    reset,
  }
}
