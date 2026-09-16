'use client'

import { useState, useMemo, useEffect } from 'react'
import { parseEther, formatEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useSwapQuote } from '@/hooks/useSwapQuote'
import { useSwap } from '@/hooks/useSwap'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import { getPriceFromBinId, formatBinPrice } from '@/lib/binMath'
import { anim } from '@/lib/animations'
import type { PairState } from '@/hooks/usePairState'
import type { BinData } from '@/hooks/useBinRange'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

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

// ── Bin impact simulation ────────────────────────────────────────────────────

type BinImpact = {
  binId: number
  /** How much of the input token is deposited into this bin */
  amountIn: bigint
  /** How much of the output token is withdrawn from this bin */
  amountOut: bigint
  /** Fraction of the bin's output reserve that is consumed (0–1) */
  fractionConsumed: number
  isActive: boolean
  isFullyDrained: boolean
}

/**
 * Constant-sum DLMM swap simulation.
 * For each bin the price converts between token directions, giving accurate
 * per-bin amountIn / amountOut values (pre-fee approximation, good enough for display).
 */
function simulateSwapImpact(
  bins: BinData[],
  activeBinId: number,
  binStep: number,
  swapForY: boolean,
  amountIn: bigint,
  totalAmountOut: bigint,
): BinImpact[] {
  if (amountIn <= 0n || bins.length === 0 || totalAmountOut <= 0n) return []

  // swapForY=true : selling tokenX → consuming Y reserves, active bin and below
  // swapForY=false: selling tokenY → consuming X reserves, active bin and above
  const ordered = swapForY
    ? [...bins].sort((a, b) => b.binId - a.binId).filter((b) => b.binId <= activeBinId)
    : [...bins].sort((a, b) => a.binId - b.binId).filter((b) => b.binId >= activeBinId)

  let remainingIn = Number(amountIn)
  const raw: Array<{ binId: number; rawIn: number; rawOut: number; reserveOut: number; isActive: boolean }> = []

  for (const bin of ordered) {
    // price = tokenY per tokenX for this bin
    const price = getPriceFromBinId(bin.binId, binStep)

    // How much input can this bin absorb before its output reserve is exhausted?
    const reserveOut = Number(swapForY ? bin.reserveY : bin.reserveX)
    if (reserveOut <= 0) continue
    const maxIn = swapForY ? reserveOut / price : reserveOut * price

    const consumedIn  = Math.min(remainingIn, maxIn)
    const consumedOut = swapForY ? consumedIn * price : consumedIn / price

    raw.push({ binId: bin.binId, rawIn: consumedIn, rawOut: consumedOut, reserveOut, isActive: bin.binId === activeBinId })
    remainingIn -= consumedIn
    if (remainingIn < 1) break // epsilon: 1 wei
  }

  if (raw.length === 0) return []

  // Scale amountOut values so their sum matches the on-chain quote (fees included)
  const estimatedTotalOut = raw.reduce((s, r) => s + r.rawOut, 0)
  const outScale = estimatedTotalOut > 0 ? Number(totalAmountOut) / estimatedTotalOut : 1

  return raw.map((r, i) => {
    const scaledOut = BigInt(Math.round(r.rawOut * outScale))
    const fractionConsumed = r.rawIn / (swapForY ? r.reserveOut / getPriceFromBinId(r.binId, binStep) : r.reserveOut * getPriceFromBinId(r.binId, binStep))
    return {
      binId: r.binId,
      amountIn: BigInt(Math.round(r.rawIn)),
      amountOut: scaledOut,
      fractionConsumed: Math.min(1, fractionConsumed),
      isActive: r.isActive,
      isFullyDrained: i < raw.length - 1 || fractionConsumed > 0.999,
    }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  bins: BinData[]
  onSwapChange?: (swapForY: boolean, amountIn: bigint) => void
}

export function SwapPanel({ pairState, tokenXSymbol, tokenYSymbol, bins, onSwapChange }: Props) {
  const [tokenInIsX, setTokenInIsX] = useState(true)
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [offMarket, setOffMarket] = useState(!isMarketHours())

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

  // Per-bin impact simulation (only when quote is ready)
  const binImpact = useMemo(() => {
    if (quoteLoading || amountOut <= 0n) return []
    return simulateSwapImpact(
      bins,
      pairState.activeId,
      pairState.binStep,
      swapForY,
      parsedAmountIn,
      amountOut,
    )
  }, [bins, pairState.activeId, pairState.binStep, swapForY, parsedAmountIn, amountOut, quoteLoading])

  const newActiveBinId = binImpact.length > 1 ? binImpact[binImpact.length - 1].binId : null

  useEffect(() => {
    if (isSuccess) { setAmountIn(''); reset() }
  }, [isSuccess, reset])

  useEffect(() => {
    onSwapChange?.(swapForY, parsedAmountIn)
  }, [swapForY, parsedAmountIn, onSwapChange])

  function handleFlip() {
    setTokenInIsX((v) => !v)
    setAmountIn('')
    reset()
  }

  const VISIBLE_BINS = 4

  return (
    <div className="flex flex-col gap-3">
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

      {/* Flip */}
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

      {/* Quote summary */}
      <AnimatePresence>
        {amountOut > 0n && (
          <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
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

      {/* Bin-by-bin impact */}
      <AnimatePresence>
        {binImpact.length > 0 && (
          <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
            <div className="rounded-lg border border-border bg-surface-overlay p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Bin impact</p>
                {binImpact.length > 1 && (
                  <span className="text-[10px] text-warning">
                    {binImpact.length} bin{binImpact.length > 1 ? 's' : ''} crossed
                  </span>
                )}
              </div>

              {binImpact.slice(0, VISIBLE_BINS).map((impact) => (
                <div key={impact.binId} className="space-y-1.5">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {impact.isActive && (
                        <span className="text-[9px]" style={{ color: '#76fff4' }}>●</span>
                      )}
                      <span className="text-[10px] font-mono text-text-secondary">
                        Bin {impact.binId}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        @ {formatBinPrice(impact.binId, pairState.binStep, 4)}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono ${impact.isFullyDrained ? 'text-warning' : 'text-text-muted'}`}>
                      {(impact.fractionConsumed * 100).toFixed(1)}%
                      {impact.isFullyDrained && ' drained'}
                    </span>
                  </div>

                  {/* Fill bar */}
                  <div className="h-0.5 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${impact.fractionConsumed * 100}%`,
                        backgroundColor: impact.isFullyDrained ? '#f59e0b' : '#0DAB76',
                      }}
                    />
                  </div>

                  {/* Amounts */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: '#0DAB76' }}>
                      +{fmtAmount(impact.amountIn, 6)} {tokenInSymbol}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: '#ef4444' }}>
                      −{fmtAmount(impact.amountOut, 6)} {tokenOutSymbol}
                    </span>
                  </div>
                </div>
              ))}

              {binImpact.length > VISIBLE_BINS && (
                <p className="text-[10px] text-text-muted">
                  +{binImpact.length - VISIBLE_BINS} more bins consumed
                </p>
              )}

              {/* New active bin (only when crossing bins) */}
              {newActiveBinId !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide">New active bin</span>
                  <span className="text-[10px] font-mono" style={{ color: '#76fff4' }}>
                    #{newActiveBinId} · {formatBinPrice(newActiveBinId, pairState.binStep, 4)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Off-market warning */}
      <AnimatePresence>
        {offMarket && (
          <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
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
            <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
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
              pair: pairState.address,
              tokenIn,
              tokenOut,
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
          <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
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
          <motion.div {...anim.slide} style={{ overflow: 'hidden' }}>
            <div className="p-2.5 rounded-lg bg-error/10 border border-error/20">
              <p className="text-xs text-error">{error.message.slice(0, 200)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
