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
 * Normalize a bin's raw reserves to a common tokenY unit so that bars
 * reflect economic value rather than raw token counts.
 *
 * price = tokenX per tokenY (e.g. AMZN per WETH from getPriceFromBinId).
 * Dividing reserveX by that price converts it to tokenY-equivalent units.
 * Pass the active-bin price to keep all bars on the same scale (StrategyPreview),
 * or pass each bin's own price for per-bin accuracy (BinChart, BinMiniChart).
 */
export function binReservesToValue(
  reserveX: bigint | number,
  reserveY: bigint | number,
  price: number,
): { valueX: number; valueY: number; total: number } {
  const vX = price > 0 ? Number(reserveX) / price : 0
  const vY = Number(reserveY)
  return { valueX: vX, valueY: vY, total: vX + vY }
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

export type DistShape = 'linear' | 'exponential'

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

  // Count bins that receive each token.
  // The active bin gets HALF weight from each side so that when both
  // contributions combine, its total value equals a single full bin.
  const hasActiveBin = startBin <= activeBinId && endBin >= activeBinId
  let binsWithX = 0
  let binsWithY = 0
  for (let id = startBin; id <= endBin; id++) {
    if (id >= activeBinId) binsWithX++
    if (id <= activeBinId) binsWithY++
  }

  // Active bin counts as half a bin on each side:
  // totalX = (binsWithX - 1) full + 0.5 active = binsWithX - 0.5
  // We use 2x precision to avoid fractions: share = 2*PRECISION / (2*binsWithX - 1)
  // Active gets half that: PRECISION / (2*binsWithX - 1)
  const fullShareX = hasActiveBin && binsWithX > 0
    ? (2n * PRECISION) / BigInt(2 * binsWithX - 1)
    : (binsWithX > 0 ? PRECISION / BigInt(binsWithX) : 0n)
  const halfShareX = hasActiveBin && binsWithX > 0
    ? PRECISION / BigInt(2 * binsWithX - 1)
    : fullShareX

  const fullShareY = hasActiveBin && binsWithY > 0
    ? (2n * PRECISION) / BigInt(2 * binsWithY - 1)
    : (binsWithY > 0 ? PRECISION / BigInt(binsWithY) : 0n)
  const halfShareY = hasActiveBin && binsWithY > 0
    ? PRECISION / BigInt(2 * binsWithY - 1)
    : fullShareY

  for (let id = startBin; id <= endBin; id++) {
    binIds.push(id)
    if (id < activeBinId) {
      distributionX.push(0n)
      distributionY.push(fullShareY)
    } else if (id > activeBinId) {
      distributionX.push(fullShareX)
      distributionY.push(0n)
    } else {
      // Active bin gets half from each side
      distributionX.push(halfShareX)
      distributionY.push(halfShareY)
    }
  }

  return { binIds, distributionX, distributionY }
}

/**
 * Curve distribution: concentrated around active bin. Requires ≥ 3 bins.
 */
export function generateCurveDistribution(
  activeBinId: number,
  startBin: number,
  endBin: number,
  shape: DistShape = 'exponential',
  intensity = 1.0,
): Distribution {
  const maxDist = Math.max(activeBinId - startBin, endBin - activeBinId, 1)
  const weightFn = shape === 'linear'
    ? (d: number) => maxDist + 1 - Math.abs(d)
    : (d: number) => Math.exp(-Math.abs(d) * intensity)
  return buildWeightedDistribution(activeBinId, startBin, endBin, weightFn)
}

/**
 * Bid-Ask distribution: most liquidity on edges, least at center. Requires ≥ 3 bins.
 */
export function generateBidAskDistribution(
  activeBinId: number,
  startBin: number,
  endBin: number,
  shape: DistShape = 'exponential',
  intensity = 1.0,
): Distribution {
  const weightFn = shape === 'linear'
    ? (d: number) => Math.abs(d) + 1
    : (d: number) => Math.exp(Math.abs(d) * intensity * 0.5)
  return buildWeightedDistribution(activeBinId, startBin, endBin, weightFn)
}

/** Shared helper for weighted distributions (curve, bid-ask). */
function buildWeightedDistribution(
  activeBinId: number,
  startBin: number,
  endBin: number,
  weightFn: (distance: number) => number,
): Distribution {
  const binIds: number[] = []
  const rawWeights: number[] = []

  const hasActiveBin = startBin <= activeBinId && endBin >= activeBinId
  let totalWeightX = 0
  let totalWeightY = 0

  for (let id = startBin; id <= endBin; id++) {
    const distance = id - activeBinId
    const weight = weightFn(distance)
    binIds.push(id)
    rawWeights.push(weight)

    // Active bin contributes half weight to each side's total
    if (id === activeBinId && hasActiveBin) {
      totalWeightY += weight / 2
      totalWeightX += weight / 2
    } else {
      if (id <= activeBinId) totalWeightY += weight
      if (id >= activeBinId) totalWeightX += weight
    }
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
      // Active bin: half weight from each side
      const halfWeight = weight / 2
      distributionX.push(BigInt(Math.round((halfWeight / totalWeightX) * Number(PRECISION))))
      distributionY.push(BigInt(Math.round((halfWeight / totalWeightY) * Number(PRECISION))))
    }
  }

  // Normalize: adjust the largest non-zero element in each array so the sum
  // is exactly PRECISION. Math.round() introduces up to ±0.5 per element,
  // and those rounding errors accumulate — causing the contract to demand
  // slightly more tokens than the user holds (TRANSFER_FROM_FAILED).
  normalizeToPrecision(distributionX)
  normalizeToPrecision(distributionY)

  return { binIds, distributionX, distributionY }
}

/** Adjust the largest non-zero element so the array sums to exactly PRECISION. */
function normalizeToPrecision(arr: bigint[]): void {
  const sum = arr.reduce((a, b) => a + b, 0n)
  if (sum === 0n || sum === PRECISION) return
  const diff = PRECISION - sum  // negative when sum > PRECISION
  let maxIdx = -1
  let maxVal = 0n
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > maxVal) { maxVal = arr[i]; maxIdx = i }
  }
  if (maxIdx >= 0) arr[maxIdx] += diff
}
