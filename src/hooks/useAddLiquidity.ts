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
import { useTxToast } from './useTxToast'
import type { DistShape } from '@/lib/binMath'
import type { Address } from 'viem'

const PRECISION = 10n ** 18n

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
  intensity: number
  startBin: number
  endBin: number
}

export function useAddLiquidity() {
  const { address: account } = useAccount()
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  useTxToast({ label: 'Add Liquidity', txHash, isSuccess, error })

  function addLiquidity(params: AddLiquidityParams) {
    if (!account) return

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
    const contracts = getContracts(robinhoodTestnet.id)

    console.group('[AddLiquidity] Transaction Debug')
    console.log('Strategy:', params.strategy)
    console.log('Pair:', params.pairAddress)
    console.log('TokenX:', params.tokenX)
    console.log('TokenY:', params.tokenY)
    console.log('BinStep:', params.binStep)
    console.log('ActiveBinId:', params.activeBinId)
    console.log('Range:', params.startBin, '→', params.endBin)
    console.log('AmountX:', params.amountX.toString())
    console.log('AmountY:', params.amountY.toString())

    if (params.strategy === 'spot') {
      // Spot (uniform): equal across all bins
      const symmetric = isSymmetricRange(params.activeBinId, params.startBin, params.endBin)
      const binRange = params.endBin - params.activeBinId

      // Router addLiquidityUniform requires binRange >= 1 (rejects 0).
      // Fall through to mintDirect for a single-bin selection.
      if (symmetric && binRange > 0) {
        console.log('Mode: Router addLiquidityUniform (symmetric)')
        console.log('BinRange:', binRange)
        console.groupEnd()
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
        const label = symmetric ? 'Direct mint (single bin)' : 'Direct mint (asymmetric spot)'
        console.log('Mode:', label)
        logDistribution(dist)
        console.groupEnd()
        mintDirect(params, dist, deadline)
      }
    } else if (params.strategy === 'curve') {
      // Curve (bell curve): most liquidity at center
      const dist = generateCurveDistribution(params.activeBinId, params.startBin, params.endBin, params.shape, params.intensity)
      console.log('Mode: Direct mint (curve)')
      console.log('Shape:', params.shape, 'Intensity:', params.intensity)
      logDistribution(dist)
      console.groupEnd()
      mintDirect(params, dist, deadline)
    } else {
      // Bid-Ask (inverse curve): most liquidity on edges
      const dist = generateBidAskDistribution(params.activeBinId, params.startBin, params.endBin, params.shape, params.intensity)
      console.log('Mode: Direct mint (bid-ask)')
      console.log('Shape:', params.shape, 'Intensity:', params.intensity)
      logDistribution(dist)
      console.groupEnd()
      mintDirect(params, dist, deadline)
    }

    function logDistribution(dist: { binIds: number[]; distributionX: bigint[]; distributionY: bigint[] }) {
      console.log('Bins:', dist.binIds.length)
      const sumX = dist.distributionX.reduce((a, b) => a + b, 0n)
      const sumY = dist.distributionY.reduce((a, b) => a + b, 0n)
      console.log('Sum distributionX:', sumX.toString(), sumX === PRECISION ? '✓ (1e18)' : '⚠ NOT 1e18')
      console.log('Sum distributionY:', sumY.toString(), sumY === PRECISION ? '✓ (1e18)' : '⚠ NOT 1e18')
      console.table(dist.binIds.map((id, i) => ({
        binId: id,
        distX: dist.distributionX[i].toString(),
        distY: dist.distributionY[i].toString(),
        amountX: (params.amountX * dist.distributionX[i] / PRECISION).toString(),
        amountY: (params.amountY * dist.distributionY[i] / PRECISION).toString(),
      })))
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
