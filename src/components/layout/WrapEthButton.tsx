'use client'

import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { useWrapEth } from '@/hooks/useWrapEth'

type Mode = 'wrap' | 'unwrap'

export function WrapEthButton() {
  const { isConnected } = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('wrap')
  const [amount, setAmount] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { ethBalance, wethBalance, wrap, unwrap, isPending, isSuccess, error, txHash, reset } = useWrapEth()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Clear amount on success
  useEffect(() => {
    if (isSuccess) setAmount('')
  }, [isSuccess])

  if (!isConnected) return null

  const balance = mode === 'wrap' ? ethBalance : wethBalance
  const balanceFormatted = formatEther(balance)

  let parsedAmount = 0n
  try { parsedAmount = amount ? parseEther(amount) : 0n } catch { /* invalid */ }

  const canSubmit = parsedAmount > 0n && parsedAmount <= balance && !isPending

  function handleMax() {
    if (mode === 'wrap') {
      // Leave a small amount for gas
      const reserve = parseEther('0.001')
      const max = ethBalance > reserve ? ethBalance - reserve : 0n
      setAmount(formatEther(max))
    } else {
      setAmount(formatEther(wethBalance))
    }
  }

  function handleSubmit() {
    if (!canSubmit) return
    reset()
    if (mode === 'wrap') wrap(parsedAmount)
    else unwrap(parsedAmount)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); reset() }}
        className="h-8 px-2.5 rounded-lg text-xs font-medium bg-surface-overlay border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
        title="Wrap / Unwrap ETH"
      >
        Wrap/Unwrap ETH
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface-raised shadow-lg p-4 z-50 overflow-hidden">
          {/* Mode tabs */}
          <div className="flex gap-0.5 bg-surface-overlay rounded-lg p-0.5 mb-3">
            {(['wrap', 'unwrap'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setAmount(''); reset() }}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors truncate ${
                  mode === m
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {m === 'wrap' ? 'Wrap' : 'Unwrap'}
              </button>
            ))}
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted">
              {mode === 'wrap' ? 'ETH Balance' : 'WETH Balance'}
            </span>
            <span className="text-[10px] text-text-secondary font-mono">
              {Number(balanceFormatted).toFixed(6)}
            </span>
          </div>

          {/* Amount input */}
          <div className="flex items-center gap-2 bg-surface-overlay border border-border rounded-lg px-3 py-2 mb-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none font-mono"
            />
            <button
              onClick={handleMax}
              className="text-[10px] text-accent hover:text-accent-hover transition-colors font-medium"
            >
              MAX
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPending
              ? (mode === 'wrap' ? 'Wrapping…' : 'Unwrapping…')
              : (mode === 'wrap' ? 'Wrap' : 'Unwrap')
            }
          </button>

          {/* Status */}
          {isSuccess && txHash && (
            <div className="mt-2 p-2 rounded-lg bg-success/10 border border-success/20">
              <p className="text-[10px] text-success">
                {mode === 'wrap' ? 'Wrapped' : 'Unwrapped'} successfully!
              </p>
              <a
                href={`https://explorer.testnet.chain.robinhood.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline"
              >
                View transaction
              </a>
            </div>
          )}
          {error && (
            <div className="mt-2 p-2 rounded-lg bg-error/10 border border-error/20">
              <p className="text-[10px] text-error">{error.message.slice(0, 120)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
