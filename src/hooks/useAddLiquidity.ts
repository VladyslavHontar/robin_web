'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { lbRouterAbi } from '@/config/abis/LBRouter'
import { lbPairAbi } from '@/config/abis/LBPair'
import { robinhoodTestnet } from '@/config/chains'
import { getContracts } from '@/config/contracts'
import {
  generateUniformDistribution,
  generateNormalDistribution,
  isSymmetricRange,
} from '@/lib/binMath'
import type { Address } from 'viem'

export type Strategy = 'uniform' | 'normal' | 'spot'

type AddLiquidityParams = {
  pairAddress: Address
  tokenX: Address
  tokenY: Address
  binStep: number
  activeBinId: number
  amountX: bigint
  amountY: bigint
  strategy: Strategy
  startBin: number
  endBin: number
  spotBinId?: number
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

    if (params.strategy === 'uniform') {
      const symmetric = isSymmetricRange(params.activeBinId, params.startBin, params.endBin)

      if (symmetric) {
        // Symmetric: use router's efficient addLiquidityUniform
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
        // Asymmetric: call LBPair.mint() directly
        const dist = generateUniformDistribution(params.activeBinId, params.startBin, params.endBin)
        writeContract({
          address: params.pairAddress,
          abi: lbPairAbi,
          functionName: 'mint',
          args: [
            {
              binIds: dist.binIds,
              distributionX: dist.distributionX,
              distributionY: dist.distributionY,
              amountX: params.amountX,
              amountY: params.amountY,
              activeIdDesired: params.activeBinId,
              idSlippage: 5,
              deadline,
              to: account,
            },
          ],
          chainId: robinhoodTestnet.id,
        })
      }
    } else if (params.strategy === 'spot') {
      const binId = params.spotBinId ?? params.activeBinId
      writeContract({
        address: contracts.router as Address,
        abi: lbRouterAbi,
        functionName: 'addLiquiditySpot',
        args: [
          params.tokenX,
          params.tokenY,
          params.binStep,
          params.amountX,
          params.amountY,
          binId,
          account,
          deadline,
        ],
        chainId: robinhoodTestnet.id,
      })
    } else {
      // Normal: call LBPair.mint() directly with bell curve distribution
      const dist = generateNormalDistribution(params.activeBinId, params.endBin - params.activeBinId)
      writeContract({
        address: params.pairAddress,
        abi: lbPairAbi,
        functionName: 'mint',
        args: [
          {
            binIds: dist.binIds,
            distributionX: dist.distributionX,
            distributionY: dist.distributionY,
            amountX: params.amountX,
            amountY: params.amountY,
            activeIdDesired: params.activeBinId,
            idSlippage: 5,
            deadline,
            to: account,
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
