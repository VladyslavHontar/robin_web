'use client'

import { useState, useMemo, useEffect } from 'react'
import { parseEther, formatEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useSwapQuote } from '@/hooks/useSwapQuote'
import { useSwap } from '@/hooks/useSwap'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import type { PairState } from '@/hooks/usePairState'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

const slideAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0] as const

/** Returns true during NYSE market hours (13:30–20:00 UTC) */
function isMarketHours(): boolean {
  const now = new Date()
  const h = now.getUTCHours()
  const m = now.getUTCMinutes()
  const afterOpen = h > 13 || (h === 13 && m >= 30)
  const beforeClose = h < 20
  return afterOpen && beforeClose
}

function fmtAmount(value: bigint, decimals = 6): string {
  const n = Number(formatEther(value))
  if (n === 0) return '0'
  if (n < 0.000001) return '<0.000001'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmtRate(amountIn: bigint, amountOut: bigint): string {
  if (amountIn === 0n || amountOut === 0n) return '—'
  const rate = Number(formatEther(amountOut)) / Number(formatEther(amountIn))
  return rate.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  /** Called whenever direction or input amount changes — used by parent for chart overlay */
  onSwapChange?: (swapForY: boolean, amountIn: bigint) => void
}

export function SwapPanel({ pairState, tokenXSymbol, tokenYSymbol, onSwapChange }: Props) {
  const [tokenInIsX, setTokenInIsX] = useState(true)
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [offMarket, setOffMarket] = useState(!isMarketHours())

  // Refresh off-market status every minute
  useEffect(() => {
    const id = setInterval(() => setOffMarket(!isMarketHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  const tokenIn  = tokenInIsX ? pairState.tokenX : pairState.tokenY
  const tokenOut = tokenInIsX ? pairState.tokenY : pairState.tokenX
  const tokenInSymbol  = tokenInIsX ? tokenXSymbol : tokenYSymbol
  const tokenOutSymbol = tokenInIsX ? tokenYSymbol : tokenXSymbol
  const swapForY = tokenInIsX

  const parsedAmountIn = useMemo(() => {
    try { return amountIn ? parseEther(amountIn) : 0n } catch { return 0n }
  }, [amountIn])

  const { amountOut, fees, feeRateBps, isLoading: quoteLoading } = useSwapQuote(
    pairState.address,
    swapForY,
    parsedAmountIn,
  )

  const slippageBps = Math.round(slippage * 100)
  const minAmountOut = amountOut > 0n
    ? (amountOut * BigInt(10_000 - slippageBps)) / 10_000n
    : 0n

  const contracts = getContracts(robinhoodTestnet.id)
  const approval = useTokenApproval(tokenIn, contracts.router as `0x${string}`)
  const { executeSwap, isPending, isSuccess, error, txHash, reset } = useSwap()

  const needsApproval = parsedAmountIn > 0n && approval.needsApproval(parsedAmountIn)
  const canSwap = parsedAmountIn > 0n && amountOut > 0n && !needsApproval && !isPending

  // Clear after success
  useEffect(() => {
    if (isSuccess) {
      setAmountIn('')
      reset()
    }
  }, [isSuccess, reset])

  // Notify parent of swap state changes for chart overlay
  useEffect(() => {
    onSwapChange?.(swapForY, parsedAmountIn)
  }, [swapForY, parsedAmountIn, onSwapChange])

  // Reset state when direction flips
  function handleFlip() {
    setTokenInIsX((v) => !v)
    setAmountIn('')
    reset()
  }

  return (
    <div className="flex flex-col gap-3 max-w-md">
      {/* From */}
      <div className="rounded-lg border border-border bg-surface-overlay p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wide">From</span>
          <span className="text-xs font-medium text-text-secondary">{tokenInSymbol}</span>
        </div>
        <input
          type="number"
          min="0"
          placeholder="0.0"
          value={amountIn}
          onChange={(e) => { setAmountIn(e.target.value); reset() }}
          className="w-full bg-transparent text-lg font-mono text-text-primary outline-none placeholder:text-text-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>

      {/* Flip button */}
      <div className="flex justify-center">
        <button
          onClick={handleFlip}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-border bg-surface-overlay text-text-muted hover:text-accent hover:border-accent/40 transition-colors text-base"
          title="Flip direction"
        >
          ⇅
        </button>
      </div>

      {/* To */}
      <div className="rounded-lg border border-border bg-surface-overlay p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-muted uppercase tracking-wide">To</span>
          <span className="text-xs font-medium text-text-secondary">{tokenOutSymbol}</span>
        </div>
        <div className="text-lg font-mono text-text-primary min-h-[28px]">
          {quoteLoading && parsedAmountIn > 0n ? (
            <span className="text-text-muted text-sm">Fetching quote…</span>
          ) : amountOut > 0n ? (
            fmtAmount(amountOut)
          ) : (
            <span className="text-text-muted">0.0</span>
          )}
        </div>
      </div>

      {/* Quote details */}
      <AnimatePresence>
        {amountOut > 0n && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="rounded-lg border border-border bg-surface-overlay p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">Rate</span>
                <span className="text-xs font-mono text-text-primary">
                  1 {tokenInSymbol} ≈ {fmtRate(parsedAmountIn, amountOut)} {tokenOutSymbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">Fee</span>
                <span className="text-xs font-mono text-text-primary">
                  {(feeRateBps / 100).toFixed(2)}%
                  <span className="text-text-muted ml-1">({fmtAmount(fees, 8)} {tokenInSymbol})</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted">Min received</span>
                <span className="text-xs font-mono text-text-primary">
                  {fmtAmount(minAmountOut)} {tokenOutSymbol}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Off-market hours warning */}
      <AnimatePresence>
        {offMarket && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-warning/30 bg-warning/5">
              <span className="text-warning text-xs">⚠</span>
              <p className="text-xs text-warning">
                Outside market hours — fees are <strong>1.5×</strong> (quoted amount already reflects this)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slippage */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">Slippage tolerance</p>
        <div className="flex gap-1.5">
          {SLIPPAGE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setSlippage(p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                slippage === p
                  ? 'bg-accent text-white'
                  : 'border border-border text-text-muted hover:text-text-secondary hover:border-accent/40'
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Approve + Swap */}
      <div className="space-y-2">
        <AnimatePresence>
          {needsApproval && (
            <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
              <button
                onClick={() => approval.approve(parsedAmountIn)}
                disabled={approval.isPending}
                className="w-full py-2 rounded-lg text-sm font-medium border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
              >
                {approval.isPending ? 'Approving…' : `Approve ${tokenInSymbol}`}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() =>
            executeSwap({
              tokenIn,
              tokenOut,
              binStep: pairState.binStep,
              amountIn: parsedAmountIn,
              minAmountOut,
            })
          }
          disabled={!canSwap}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Swapping…' : 'Swap'}
        </button>
      </div>

      {/* Status */}
      <AnimatePresence>
        {isSuccess && txHash && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
              <p className="text-xs text-success">Swap successful!</p>
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline"
              >
                View transaction
              </a>
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
            <div className="p-2.5 rounded-lg bg-error/10 border border-error/20">
              <p className="text-xs text-error">{error.message.slice(0, 200)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
