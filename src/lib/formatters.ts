/**
 * Truncate an address: 0x1234...abcd
 */
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format a number with commas and decimal places.
 */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format basis points as percentage string.
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Format a bigint wei value to ether string.
 */
export function formatWei(wei: bigint, decimals = 18, displayDecimals = 4): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = wei / divisor
  const remainder = wei % divisor
  const fracStr = remainder.toString().padStart(decimals, '0').slice(0, displayDecimals)
  return `${whole.toLocaleString()}.${fracStr}`
}

/**
 * Format a timestamp as relative time (e.g., "5m ago").
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
