import { INITIAL_BIN_ID } from './constants'

/**
 * Convert bin ID to human-readable price.
 * Mirrors Solidity: price = (1 + binStep/10000)^(binId - INITIAL_BIN_ID)
 */
export function getPriceFromBinId(binId: number, binStep: number): number {
  const exp = binId - INITIAL_BIN_ID
  return Math.pow(1 + binStep / 10_000, exp)
}

/**
 * Format bin price for display.
 */
export function formatBinPrice(binId: number, binStep: number, decimals = 6): string {
  const price = getPriceFromBinId(binId, binStep)
  if (price >= 1_000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(decimals)
}

/**
 * Get bin ID from a target price (approximate).
 * Inverse: binId = log(price) / log(1 + binStep/10000) + INITIAL_BIN_ID
 */
export function getBinIdFromPrice(price: number, binStep: number): number {
  if (price <= 0) return INITIAL_BIN_ID
  const logBase = Math.log(1 + binStep / 10_000)
  return Math.round(Math.log(price) / logBase) + INITIAL_BIN_ID
}

/**
 * Get the bin step tier label.
 */
export function getBinStepTier(binStep: number): string {
  if (binStep <= 10) return 'Ultra-Tight'
  if (binStep <= 50) return 'Standard'
  return 'Wide'
}

export type Distribution = {
  binIds: number[]
  distributionX: bigint[]
  distributionY: bigint[]
}

const PRECISION = 10n ** 18n

/**
 * Uniform distribution: equal liquidity across all bins in range.
 * Mirrors LBRouter._generateUniformDistribution logic.
 */
export function generateUniformDistribution(
  activeBinId: number,
  binRange: number,
): Distribution {
  const startBin = activeBinId - binRange
  const endBin = activeBinId + binRange
  const totalBins = endBin - startBin + 1

  const binIds: number[] = []
  const distributionX: bigint[] = []
  const distributionY: bigint[] = []

  const sharePerBin = PRECISION / BigInt(totalBins)

  for (let id = startBin; id <= endBin; id++) {
    binIds.push(id)
    if (id < activeBinId) {
      // Below active: only token Y
      distributionX.push(0n)
      distributionY.push(sharePerBin)
    } else if (id > activeBinId) {
      // Above active: only token X
      distributionX.push(sharePerBin)
      distributionY.push(0n)
    } else {
      // Active bin: both tokens
      distributionX.push(sharePerBin)
      distributionY.push(sharePerBin)
    }
  }

  return { binIds, distributionX, distributionY }
}

/**
 * Normal (bell curve) distribution: weight = 100 / (1 + distance²).
 * Higher concentration around active bin.
 */
export function generateNormalDistribution(
  activeBinId: number,
  binRange: number,
): Distribution {
  const startBin = activeBinId - binRange
  const endBin = activeBinId + binRange

  const binIds: number[] = []
  const rawWeights: number[] = []

  let totalWeightX = 0
  let totalWeightY = 0

  for (let id = startBin; id <= endBin; id++) {
    const distance = id - activeBinId
    const weight = 100 / (1 + distance * distance)
    binIds.push(id)
    rawWeights.push(weight)

    if (id <= activeBinId) totalWeightY += weight
    if (id >= activeBinId) totalWeightX += weight
  }

  const distributionX: bigint[] = []
  const distributionY: bigint[] = []

  for (let i = 0; i < binIds.length; i++) {
    const id = binIds[i]
    const weight = rawWeights[i]

    if (id < activeBinId) {
      distributionX.push(0n)
      distributionY.push(BigInt(Math.round((weight / totalWeightY) * Number(PRECISION))))
    } else if (id > activeBinId) {
      distributionX.push(BigInt(Math.round((weight / totalWeightX) * Number(PRECISION))))
      distributionY.push(0n)
    } else {
      distributionX.push(BigInt(Math.round((weight / totalWeightX) * Number(PRECISION))))
      distributionY.push(BigInt(Math.round((weight / totalWeightY) * Number(PRECISION))))
    }
  }

  return { binIds, distributionX, distributionY }
}

/**
 * Spot distribution: all liquidity into a single bin.
 */
export function generateSpotDistribution(binId: number): Distribution {
  return {
    binIds: [binId],
    distributionX: [PRECISION],
    distributionY: [PRECISION],
  }
}
