'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { parseEther, type Address } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { TokenInput } from './TokenInput'
import { ScrollPicker } from './ScrollPicker'
import { StrategyPreview, type OverlayBin } from './StrategyPreview'
import { RemoveLiquidityPanel } from './RemoveLiquidityPanel'
import { SwapPanel } from './SwapPanel'
import { UnclaimedFeesCard } from './UnclaimedFeesCard'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useAddLiquidity, type Strategy } from '@/hooks/useAddLiquidity'
import { useUserPositions } from '@/hooks/useUserPositions'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import {
  generateUniformDistribution,
  generateCurveDistribution,
  generateBidAskDistribution,
  getRequiredTokens,
  isSymmetricRange,
} from '@/lib/binMath'
import type { DistShape, Distribution } from '@/lib/binMath'
import type { PairState } from '@/hooks/usePairState'
import type { BinData } from '@/hooks/useBinRange'

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  bins: BinData[]
}

const strategies: { key: Strategy; label: string; desc: string; minBins: number }[] = [
  { key: 'spot', label: 'Spot', desc: 'Equal liquidity across all bins', minBins: 1 },
  { key: 'curve', label: 'Curve', desc: 'Concentrated around active bin', minBins: 3 },
  { key: 'bidask', label: 'Bid-Ask', desc: 'Most liquidity on the edges', minBins: 3 },
]

const slideAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
}

const EMPTY_DISTRIBUTION: Distribution = { binIds: [], distributionX: [], distributionY: [] }
const NOOP_DIST_FN = (): Distribution => EMPTY_DISTRIBUTION
const NOOP_RANGE_FN = () => {}

type Mode = 'add' | 'remove' | 'swap'

/**
 * Simulate which bins get consumed by a swap (for overlay visualization).
 * Uses constant-sum model (no fee) — good enough for a visual approximation.
 */
function buildSwapOverlay(
  bins: BinData[],
  activeBinId: number,
  swapForY: boolean,
  amountIn: bigint,
): OverlayBin[] {
  if (amountIn <= 0n) return []
  // swapForY=true: consuming Y, bins ordered from active downward (lower IDs have more Y)
  // swapForY=false: consuming X, bins ordered from active upward (higher IDs have more X)
  const ordered = swapForY
    ? [...bins].sort((a, b) => b.binId - a.binId).filter((b) => b.binId <= activeBinId)
    : [...bins].sort((a, b) => a.binId - b.binId).filter((b) => b.binId >= activeBinId)

  let remaining = Number(amountIn)
  const result: OverlayBin[] = []
  for (const bin of ordered) {
    const reserve = swapForY ? Number(bin.reserveY) : Number(bin.reserveX)
    if (reserve <= 0) continue
    const consumed = Math.min(remaining, reserve)
    result.push({
      binId: bin.binId,
      fractionX: swapForY ? 0 : consumed / reserve,
      fractionY: swapForY ? consumed / reserve : 0,
    })
    remaining -= consumed
    if (remaining <= 0) break
  }
  return result
}

export function AddLiquidityPanel({ pairState, tokenXSymbol, tokenYSymbol, bins }: Props) {
  const { isConnected } = useAccount()
  const [mode, setMode] = useState<Mode>('add')

  // ── Add-mode state ──────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<Strategy>('spot')
  const [amountX, setAmountX] = useState('')
  const [amountY, setAmountY] = useState('')
  const [startBin, setStartBin] = useState(pairState.activeId - 5)
  const [endBin, setEndBin] = useState(pairState.activeId + 5)
  const [distShape, setDistShape] = useState<DistShape>('exponential')
  const [expIntensity, setExpIntensity] = useState(1.0)

  // ── Remove-mode state (lifted for chart overlay) ────────────────────────
  const [removePercentage, setRemovePercentage] = useState(100)
  const { positions, isLoading: positionsLoading } = useUserPositions(pairState.address, bins)

  // ── Swap-mode state (lifted for chart overlay) ──────────────────────────
  const [swapIsForY, setSwapIsForY] = useState(true)
  const [swapAmountIn, setSwapAmountIn] = useState(0n)

  const contracts = getContracts(robinhoodTestnet.id)

  const totalBins = endBin - startBin + 1
  const currentStrategyConfig = strategies.find((s) => s.key === strategy)!
  const tooFewBins = totalBins < currentStrategyConfig.minBins

  const requiredTokens = useMemo(
    () => getRequiredTokens(pairState.activeId, startBin, endBin),
    [pairState.activeId, startBin, endBin],
  )

  const spender = useMemo(() => {
    if (strategy === 'spot') {
      return isSymmetricRange(pairState.activeId, startBin, endBin)
        ? (contracts.router as Address)
        : pairState.address
    }
    return pairState.address
  }, [strategy, pairState.activeId, pairState.address, startBin, endBin, contracts.router])

  const approvalX = useTokenApproval(pairState.tokenX, spender)
  const approvalY = useTokenApproval(pairState.tokenY, spender)
  const { addLiquidity, isPending, isSuccess, error, txHash, reset } = useAddLiquidity()

  const parsedAmountX = useMemo(() => {
    try { return amountX ? parseEther(amountX) : 0n } catch { return 0n }
  }, [amountX])

  const parsedAmountY = useMemo(() => {
    try { return amountY ? parseEther(amountY) : 0n } catch { return 0n }
  }, [amountY])

  useEffect(() => {
    if (requiredTokens === 'onlyX' && amountY !== '') setAmountY('')
    if (requiredTokens === 'onlyY' && amountX !== '') setAmountX('')
  }, [requiredTokens, amountX, amountY])

  useEffect(() => {
    if (isSuccess) { setAmountX(''); setAmountY('') }
  }, [isSuccess])

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    const clampedStart = Math.max(0, newStart)
    const clampedEnd = Math.min(16_777_215, newEnd)
    if (clampedStart <= clampedEnd) { setStartBin(clampedStart); setEndBin(clampedEnd) }
  }, [])

  const distribution = useMemo(() => {
    if (strategy === 'spot') return generateUniformDistribution(pairState.activeId, startBin, endBin)
    if (strategy === 'curve') return generateCurveDistribution(pairState.activeId, startBin, endBin, distShape, expIntensity)
    return generateBidAskDistribution(pairState.activeId, startBin, endBin, distShape, expIntensity)
  }, [strategy, pairState.activeId, startBin, endBin, distShape, expIntensity])

  const distributionFn = useCallback(
    (s: number, e: number) => {
      if (strategy === 'spot') return generateUniformDistribution(pairState.activeId, s, e)
      if (strategy === 'curve') return generateCurveDistribution(pairState.activeId, s, e, distShape, expIntensity)
      return generateBidAskDistribution(pairState.activeId, s, e, distShape, expIntensity)
    },
    [strategy, pairState.activeId, distShape, expIntensity],
  )

  // ── Overlay data for the chart ──────────────────────────────────────────
  // When in remove mode, only show/affect bins within the selected range
  const filteredPositions = useMemo(
    () => mode === 'remove'
      ? positions.filter((p) => p.binId >= startBin && p.binId <= endBin)
      : positions,
    [mode, positions, startBin, endBin],
  )

  const removeOverlayBins = useMemo<OverlayBin[] | undefined>(() => {
    if (mode !== 'remove' || filteredPositions.length === 0) return undefined
    return filteredPositions.map((p) => {
      const userFraction = p.totalShares > 0n ? Number(p.shares) / Number(p.totalShares) : 0
      const fraction = userFraction * (removePercentage / 100)
      return { binId: p.binId, fractionX: fraction, fractionY: fraction }
    })
  }, [mode, filteredPositions, removePercentage])

  const swapOverlayBins = useMemo<OverlayBin[] | undefined>(() => {
    if (mode !== 'swap' || swapAmountIn <= 0n) return undefined
    return buildSwapOverlay(bins, pairState.activeId, swapIsForY, swapAmountIn)
  }, [mode, bins, pairState.activeId, swapIsForY, swapAmountIn])

  const overlayBins = mode === 'remove' ? removeOverlayBins : mode === 'swap' ? swapOverlayBins : undefined
  const overlayColor = mode === 'remove' ? 'var(--color-overlay-remove)' : 'var(--color-overlay-swap)'
  const overlayLabel = mode === 'remove' ? 'to remove' : mode === 'swap' ? 'consumed' : undefined
  const userBinIds = useMemo(() => positions.map((p) => p.binId), [positions])

  // ── Chart props — consistent across all modes ───────────────────────────
  const chartProps = {
    activeBinId: pairState.activeId,
    binStep: pairState.binStep,
    bins,
    tokenXSymbol,
    tokenYSymbol,
    startBin,
    endBin,
    overlayBins,
    overlayColor,
    overlayLabel,
    userBinIds,
  }

  const showTokenX = requiredTokens === 'both' || requiredTokens === 'onlyX'
  const showTokenY = requiredTokens === 'both' || requiredTokens === 'onlyY'
  const needsApproveX = showTokenX && parsedAmountX > 0n && approvalX.needsApproval(parsedAmountX)
  const needsApproveY = showTokenY && parsedAmountY > 0n && approvalY.needsApproval(parsedAmountY)
  const canSubmit = !tooFewBins && (parsedAmountX > 0n || parsedAmountY > 0n) && !needsApproveX && !needsApproveY

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Liquidity</h3>
        <p className="text-sm text-text-muted">Connect your wallet to manage liquidity.</p>
      </div>
    )
  }

  function handleSubmit() {
    addLiquidity({
      pairAddress: pairState.address,
      tokenX: pairState.tokenX,
      tokenY: pairState.tokenY,
      binStep: pairState.binStep,
      activeBinId: pairState.activeId,
      amountX: parsedAmountX,
      amountY: parsedAmountY,
      strategy,
      shape: distShape,
      intensity: expIntensity,
      startBin,
      endBin,
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      {/* Mode toggle + unclaimed fees on the same row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-surface-overlay rounded-lg p-1 w-fit">
          {(['add', 'remove', 'swap'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset() }}
              className={`relative px-4 py-1.5 rounded-md text-xs font-medium transition-colors z-10 ${
                mode === m ? 'text-white' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {mode === m && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute inset-0 bg-accent rounded-md"
                  transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {m === 'add' ? 'Add' : m === 'remove' ? 'Remove' : 'Swap'}
            </button>
          ))}
        </div>

        <UnclaimedFeesCard
          pairState={pairState}
          tokenXSymbol={tokenXSymbol}
          tokenYSymbol={tokenYSymbol}
          positions={positions}
        />
      </div>

      {/* Always-visible grid: chart left, controls right */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] lg:h-[420px] gap-5">

        {/* LEFT — Liquidity Preview (adapts per mode) */}
        <div className="lg:h-full">
          <StrategyPreview
            {...chartProps}
            distribution={mode === 'add' ? distribution : EMPTY_DISTRIBUTION}
            amountX={mode === 'add' ? parsedAmountX : 0n}
            amountY={mode === 'add' ? parsedAmountY : 0n}
            onRangeChange={mode !== 'swap' ? handleRangeChange : NOOP_RANGE_FN}
            editable={mode !== 'swap'}
            distributionFn={mode === 'add' ? distributionFn : NOOP_DIST_FN}
          />
        </div>

        {/* RIGHT — Mode-specific controls */}
        <div className="flex flex-col lg:h-full lg:overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── Remove ── */}
            {mode === 'remove' && (
              <motion.div
                key="remove"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <RemoveLiquidityPanel
                  pairState={pairState}
                  tokenXSymbol={tokenXSymbol}
                  tokenYSymbol={tokenYSymbol}
                  positions={filteredPositions}
                  isPositionsLoading={positionsLoading}
                  percentage={removePercentage}
                  onPercentageChange={setRemovePercentage}
                />
              </motion.div>
            )}

            {/* ── Swap ── */}
            {mode === 'swap' && (
              <motion.div
                key="swap"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <SwapPanel
                  pairState={pairState}
                  tokenXSymbol={tokenXSymbol}
                  tokenYSymbol={tokenYSymbol}
                  bins={bins}
                  onSwapChange={(forY, amount) => {
                    setSwapIsForY(forY)
                    setSwapAmountIn(amount)
                  }}
                />
              </motion.div>
            )}

            {/* ── Add ── */}
            {mode === 'add' && (
              <motion.div
                key="add"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex flex-col gap-3">
                  {/* Strategy Tabs */}
                  <div className="flex gap-1 bg-surface-overlay rounded-lg p-1">
                    {strategies.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => { setStrategy(s.key); setDistShape('exponential'); setExpIntensity(1.0); reset() }}
                        className={`relative flex-1 text-xs py-1.5 px-2 rounded-md transition-colors z-10 ${
                          strategy === s.key ? 'text-white' : 'text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        {strategy === s.key && (
                          <motion.div
                            layoutId="tab-indicator"
                            className="absolute inset-0 bg-accent rounded-md"
                            transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
                            style={{ zIndex: -1 }}
                          />
                        )}
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Strategy description */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={strategy}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs text-text-muted"
                    >
                      {currentStrategyConfig.desc}
                    </motion.p>
                  </AnimatePresence>

                  {/* Shape selector + intensity */}
                  <AnimatePresence>
                    {(strategy === 'curve' || strategy === 'bidask') && (
                      <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Shape</span>
                          <div className="flex gap-0.5 bg-surface rounded-md p-0.5">
                            {(['exponential', 'linear'] as DistShape[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => setDistShape(s)}
                                className={`text-[10px] py-1 px-2.5 rounded transition-colors ${
                                  distShape === s ? 'bg-accent text-white' : 'text-text-muted hover:text-text-secondary'
                                }`}
                              >
                                {s === 'exponential' ? 'Exp' : 'Linear'}
                              </button>
                            ))}
                          </div>
                          {distShape === 'exponential' && (
                            <ScrollPicker
                              value={expIntensity}
                              onChange={setExpIntensity}
                              min={0.01}
                              max={3.0}
                              step={0.01}
                              format={(v) => v.toFixed(2)}
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Min bins warning */}
                  <AnimatePresence>
                    {tooFewBins && (
                      <motion.p {...slideAnim} className="text-[10px] text-warning">
                        {currentStrategyConfig.label} requires at least {currentStrategyConfig.minBins} bins
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Token Inputs */}
                  <div className="space-y-2">
                    <AnimatePresence>
                      {showTokenX && (
                        <motion.div key="tokenX" {...slideAnim} style={{ overflow: 'hidden' }}>
                          <TokenInput
                            label={`${tokenXSymbol} Amount`}
                            symbol={tokenXSymbol}
                            tokenAddress={pairState.tokenX}
                            value={amountX}
                            onChange={setAmountX}
                          />
                        </motion.div>
                      )}
                      {showTokenY && (
                        <motion.div key="tokenY" {...slideAnim} style={{ overflow: 'hidden' }}>
                          <TokenInput
                            label={`${tokenYSymbol} Amount`}
                            symbol={tokenYSymbol}
                            tokenAddress={pairState.tokenY}
                            value={amountY}
                            onChange={setAmountY}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {requiredTokens !== 'both' && (
                        <motion.p {...slideAnim} className="text-[10px] text-text-muted">
                          {requiredTokens === 'onlyX'
                            ? `Range is above active bin — only ${tokenXSymbol} needed`
                            : `Range is below active bin — only ${tokenYSymbol} needed`}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Approve & Submit */}
                  <div className="space-y-2">
                    <AnimatePresence>
                      {needsApproveX && (
                        <motion.div key="approveX" {...slideAnim} style={{ overflow: 'hidden' }}>
                          <button
                            onClick={() => approvalX.approve(parsedAmountX)}
                            disabled={approvalX.isPending}
                            className="w-full py-2 rounded-lg text-sm font-medium border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                          >
                            {approvalX.isPending ? 'Approving...' : `Approve ${tokenXSymbol}`}
                          </button>
                        </motion.div>
                      )}
                      {needsApproveY && (
                        <motion.div key="approveY" {...slideAnim} style={{ overflow: 'hidden' }}>
                          <button
                            onClick={() => approvalY.approve(parsedAmountY)}
                            disabled={approvalY.isPending}
                            className="w-full py-2 rounded-lg text-sm font-medium border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                          >
                            {approvalY.isPending ? 'Approving...' : `Approve ${tokenYSymbol}`}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || isPending}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Adding Liquidity...' : 'Add Liquidity'}
                    </button>
                  </div>

                  {/* Status */}
                  <AnimatePresence>
                    {isSuccess && txHash && (
                      <motion.div {...slideAnim} style={{ overflow: 'hidden' }}>
                        <div className="p-2.5 rounded-lg bg-success/10 border border-success/20">
                          <p className="text-xs text-success">Liquidity added successfully!</p>
                          <a
                            href={`https://explorer.testnet.chain.robinhood.com/tx/${txHash}`}
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
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
