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

export type RequiredTokens = 'both' | 'onlyX' | 'onlyY'

/**
 * Determine which tokens are needed for a given bin range.
 */
export function getRequiredTokens(
  activeBinId: number,
  startBin: number,
  endBin: number,
): RequiredTokens {
  if (startBin <= activeBinId && endBin >= activeBinId) return 'both'
  if (endBin < activeBinId) return 'onlyY'
  return 'onlyX'
}

/**
 * Check if range is symmetric around activeBinId (can use router shortcut).
 */
export function isSymmetricRange(
  activeBinId: number,
  startBin: number,
  endBin: number,
): boolean {
  return (activeBinId - startBin) === (endBin - activeBinId)
}

/**
 * Uniform distribution: equal liquidity across all bins in range.
 * Supports asymmetric ranges (startBin/endBin independent of activeBinId).
 */
export function generateUniformDistribution(
  activeBinId: number,
  startBin: number,
  endBin: number,
): Distribution {
  const binIds: number[] = []
  const distributionX: bigint[] = []
  const distributionY: bigint[] = []

  // Count bins that receive each token
  let binsWithX = 0
  let binsWithY = 0
  for (let id = startBin; id <= endBin; id++) {
    if (id >= activeBinId) binsWithX++
    if (id <= activeBinId) binsWithY++
  }

  const sharePerBinX = binsWithX > 0 ? PRECISION / BigInt(binsWithX) : 0n
  const sharePerBinY = binsWithY > 0 ? PRECISION / BigInt(binsWithY) : 0n

  for (let id = startBin; id <= endBin; id++) {
    binIds.push(id)
    if (id < activeBinId) {
      distributionX.push(0n)
      distributionY.push(sharePerBinY)
    } else if (id > activeBinId) {
      distributionX.push(sharePerBinX)
      distributionY.push(0n)
    } else {
      distributionX.push(sharePerBinX)
      distributionY.push(sharePerBinY)
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
