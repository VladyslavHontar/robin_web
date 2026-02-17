'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { parseEther, type Address } from 'viem'
import { TokenInput } from './TokenInput'
import { StrategyPreview } from './StrategyPreview'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useAddLiquidity, type Strategy } from '@/hooks/useAddLiquidity'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'
import {
  generateUniformDistribution,
  generateNormalDistribution,
  generateSpotDistribution,
  getRequiredTokens,
  isSymmetricRange,
} from '@/lib/binMath'
import type { PairState } from '@/hooks/usePairState'
import type { BinData } from '@/hooks/useBinRange'

type Props = {
  pairState: PairState
  tokenXSymbol: string
  tokenYSymbol: string
  bins: BinData[]
}

const strategies: { key: Strategy; label: string; desc: string }[] = [
  { key: 'uniform', label: 'Uniform', desc: 'Equal across all bins' },
  { key: 'normal', label: 'Normal', desc: 'Bell curve around active' },
  { key: 'spot', label: 'Spot', desc: 'Single bin' },
]

export function AddLiquidityPanel({ pairState, tokenXSymbol, tokenYSymbol, bins }: Props) {
  const { isConnected } = useAccount()
  const [strategy, setStrategy] = useState<Strategy>('uniform')
  const [amountX, setAmountX] = useState('')
  const [amountY, setAmountY] = useState('')
  const [startBin, setStartBin] = useState(pairState.activeId - 5)
  const [endBin, setEndBin] = useState(pairState.activeId + 5)
  const [spotBinId, setSpotBinId] = useState(pairState.activeId)

  const contracts = getContracts(robinhoodTestnet.id)

  const requiredTokens = useMemo(
    () => getRequiredTokens(pairState.activeId, startBin, endBin),
    [pairState.activeId, startBin, endBin],
  )

  // For uniform: symmetric → router, asymmetric → pair. For normal: pair. For spot: router.
  const spender = useMemo(() => {
    if (strategy === 'uniform') {
      return isSymmetricRange(pairState.activeId, startBin, endBin)
        ? (contracts.router as Address)
        : pairState.address
    }
    if (strategy === 'normal') return pairState.address
    return contracts.router as Address
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

  // Clear hidden token amounts when range changes
  useEffect(() => {
    if (strategy !== 'uniform') return
    if (requiredTokens === 'onlyX' && amountY !== '') setAmountY('')
    if (requiredTokens === 'onlyY' && amountX !== '') setAmountX('')
  }, [requiredTokens, strategy, amountX, amountY])

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    const clampedStart = Math.max(0, newStart)
    const clampedEnd = Math.min(16_777_215, newEnd)
    if (clampedStart <= clampedEnd) {
      setStartBin(clampedStart)
      setEndBin(clampedEnd)
    }
  }, [])

  const distribution = useMemo(() => {
    if (strategy === 'uniform') return generateUniformDistribution(pairState.activeId, startBin, endBin)
    if (strategy === 'normal') return generateNormalDistribution(pairState.activeId, endBin - pairState.activeId)
    return generateSpotDistribution(spotBinId)
  }, [strategy, pairState.activeId, startBin, endBin, spotBinId])

  const showTokenX = strategy !== 'uniform' || requiredTokens === 'both' || requiredTokens === 'onlyX'
  const showTokenY = strategy !== 'uniform' || requiredTokens === 'both' || requiredTokens === 'onlyY'

  const needsApproveX = showTokenX && parsedAmountX > 0n && approvalX.needsApproval(parsedAmountX)
  const needsApproveY = showTokenY && parsedAmountY > 0n && approvalY.needsApproval(parsedAmountY)
  const canSubmit = (parsedAmountX > 0n || parsedAmountY > 0n) && !needsApproveX && !needsApproveY

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Add Liquidity</h3>
        <p className="text-sm text-text-muted">Connect your wallet to add liquidity.</p>
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
      startBin,
      endBin,
      spotBinId,
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Add Liquidity</h3>

      {/* Strategy Tabs */}
      <div className="flex gap-1 mb-4 bg-surface-overlay rounded-lg p-1">
        {strategies.map((s) => (
          <button
            key={s.key}
            onClick={() => { setStrategy(s.key); reset() }}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
              strategy === s.key
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-text-muted mb-3">
        {strategies.find((s) => s.key === strategy)?.desc}
      </p>

      {/* Spot Bin selector (only for spot strategy) */}
      {strategy === 'spot' && (
        <div className="mb-3">
          <label className="text-xs text-text-muted block mb-1">Bin ID</label>
          <input
            type="number"
            value={spotBinId}
            onChange={(e) => setSpotBinId(Number(e.target.value))}
            className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Active bin: {pairState.activeId}
          </p>
        </div>
      )}

      {/* Distribution Preview with integrated range controls */}
      <div className="mb-3">
        <StrategyPreview
          distribution={distribution}
          activeBinId={pairState.activeId}
          binStep={pairState.binStep}
          bins={bins}
          amountX={parsedAmountX}
          amountY={parsedAmountY}
          startBin={startBin}
          endBin={endBin}
          onRangeChange={handleRangeChange}
          editable={strategy === 'uniform'}
        />
      </div>

      {/* Token Inputs — smart visibility based on range */}
      <div className="space-y-2 mb-4">
        {showTokenX && (
          <TokenInput
            label={`${tokenXSymbol} Amount`}
            symbol={tokenXSymbol}
            tokenAddress={pairState.tokenX}
            value={amountX}
            onChange={setAmountX}
          />
        )}
        {showTokenY && (
          <TokenInput
            label={`${tokenYSymbol} Amount`}
            symbol={tokenYSymbol}
            tokenAddress={pairState.tokenY}
            value={amountY}
            onChange={setAmountY}
          />
        )}
        {strategy === 'uniform' && requiredTokens !== 'both' && (
          <p className="text-[10px] text-text-muted">
            {requiredTokens === 'onlyX'
              ? `Range is above active bin — only ${tokenXSymbol} needed`
              : `Range is below active bin — only ${tokenYSymbol} needed`}
          </p>
        )}
      </div>

      {/* Approve Buttons */}
      <div className="space-y-2">
        {needsApproveX && (
          <button
            onClick={() => approvalX.approve(parsedAmountX)}
            disabled={approvalX.isPending}
            className="w-full py-2 rounded-lg text-sm font-medium border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {approvalX.isPending ? 'Approving...' : `Approve ${tokenXSymbol}`}
          </button>
        )}
        {needsApproveY && (
          <button
            onClick={() => approvalY.approve(parsedAmountY)}
            disabled={approvalY.isPending}
            className="w-full py-2 rounded-lg text-sm font-medium border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {approvalY.isPending ? 'Approving...' : `Approve ${tokenYSymbol}`}
          </button>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Adding Liquidity...' : 'Add Liquidity'}
        </button>
      </div>

      {/* Status */}
      {isSuccess && txHash && (
        <div className="mt-3 p-2.5 rounded-lg bg-success/10 border border-success/20">
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
      )}
      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-error/10 border border-error/20">
          <p className="text-xs text-error">{error.message.slice(0, 200)}</p>
        </div>
      )}
    </div>
  )
}
