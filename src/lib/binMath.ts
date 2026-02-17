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
