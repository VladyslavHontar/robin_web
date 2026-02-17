'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { lbRouterAbi } from '@/config/abis/LBRouter'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import { getContracts } from '@/config/contracts'
import {
  generateUniformDistribution,
  generateCurveDistribution,
  generateBidAskDistribution,
  isSymmetricRange,
} from '@/lib/binMath'
import type { DistShape } from '@/lib/binMath'
import type { Address } from 'viem'

export type Strategy = 'spot' | 'curve' | 'bidask'

type AddLiquidityParams = {
  pairAddress: Address
  tokenX: Address
  tokenY: Address
  binStep: number
  activeBinId: number
  amountX: bigint
  amountY: bigint
  strategy: Strategy
  shape: DistShape
  startBin: number
  endBin: number
}

export function useAddLiquidity() {
  const { address: account } = useAccount()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function addLiquidity(params: AddLiquidityParams) {
    if (!account) return

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    const contracts = getContracts(robinhoodTestnet.id)

    if (params.strategy === 'spot') {
      // Spot (uniform): equal across all bins
      const symmetric = isSymmetricRange(params.activeBinId, params.startBin, params.endBin)

      if (symmetric) {
        const binRange = params.endBin - params.activeBinId
        writeContract({
          address: contracts.router as Address,
          abi: lbRouterAbi,
          functionName: 'addLiquidityUniform',
          args: [
            params.tokenX,
            params.tokenY,
            params.binStep,
            params.amountX,
            params.amountY,
            params.activeBinId,
            binRange,
            account,
            deadline,
          ],
          chainId: robinhoodTestnet.id,
        })
      } else {
        const dist = generateUniformDistribution(params.activeBinId, params.startBin, params.endBin)
        mintDirect(params, dist, deadline)
      }
    } else if (params.strategy === 'curve') {
      // Curve (bell curve): most liquidity at center
      const dist = generateCurveDistribution(params.activeBinId, params.startBin, params.endBin, params.shape)
      mintDirect(params, dist, deadline)
    } else {
      // Bid-Ask (inverse curve): most liquidity on edges
      const dist = generateBidAskDistribution(params.activeBinId, params.startBin, params.endBin, params.shape)
      mintDirect(params, dist, deadline)
    }

    function mintDirect(
      p: AddLiquidityParams,
      dist: { binIds: number[]; distributionX: bigint[]; distributionY: bigint[] },
      dl: bigint,
    ) {
      writeContract({
        address: p.pairAddress,
        abi: lbPairAbi,
        functionName: 'mint',
        args: [
          {
            binIds: dist.binIds,
            distributionX: dist.distributionX,
            distributionY: dist.distributionY,
            amountX: p.amountX,
            amountY: p.amountY,
            activeIdDesired: p.activeBinId,
            idSlippage: 5,
            deadline: dl,
            to: account!,
          },
        ],
        chainId: robinhoodTestnet.id,
      })
    }
  }

  return {
    addLiquidity,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    txHash,
    reset,
  }
}
