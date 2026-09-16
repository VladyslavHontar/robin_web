'use client'

import { useTokenBalance } from '@/hooks/useTokenBalance'
import { formatUnits } from 'viem'
import type { Address } from 'viem'

type TokenInputProps = {
  label: string
  symbol: string
  tokenAddress: Address
  value: string
  onChange: (value: string) => void
}

export function TokenInput({ label, symbol, tokenAddress, value, onChange }: TokenInputProps) {
  const { balance, decimals } = useTokenBalance(tokenAddress)
  const dec = decimals ?? 18

  const formattedBalance = balance !== undefined ? formatUnits(balance, dec) : '—'

  function handleMax() {
    if (balance !== undefined) {
      onChange(formatUnits(balance, dec))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-overlay p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs text-text-muted">
          Balance: {formattedBalance}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (v === '' || /^\d*\.?\d*$/.test(v)) onChange(v)
          }}
          className="flex-1 bg-transparent text-lg text-text-primary outline-none placeholder:text-text-muted"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleMax}
            className="text-xs text-accent hover:text-accent-hover transition-colors px-1.5 py-0.5 rounded border border-accent/30"
          >
            MAX
          </button>
          <span className="text-sm font-medium text-text-secondary">{symbol}</span>
        </div>
      </div>
    </div>
  )
}
