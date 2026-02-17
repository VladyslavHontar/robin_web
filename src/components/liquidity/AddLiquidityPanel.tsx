'use client'

import { useState, useMemo } from 'react'
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
  const [binRange, setBinRange] = useState(5)
  const [spotBinId, setSpotBinId] = useState(pairState.activeId)

  const contracts = getContracts(robinhoodTestnet.id)

  // For uniform/spot, spender is the router. For normal, spender is the pair directly.
  const spender = strategy === 'normal'
    ? pairState.address
    : (contracts.router as Address)

  const approvalX = useTokenApproval(pairState.tokenX, spender)
  const approvalY = useTokenApproval(pairState.tokenY, spender)
  const { addLiquidity, isPending, isSuccess, error, txHash, reset } = useAddLiquidity()

  const parsedAmountX = useMemo(() => {
    try { return amountX ? parseEther(amountX) : 0n } catch { return 0n }
  }, [amountX])

  const parsedAmountY = useMemo(() => {
    try { return amountY ? parseEther(amountY) : 0n } catch { return 0n }
  }, [amountY])

  const distribution = useMemo(() => {
    if (strategy === 'uniform') return generateUniformDistribution(pairState.activeId, binRange)
    if (strategy === 'normal') return generateNormalDistribution(pairState.activeId, binRange)
    return generateSpotDistribution(spotBinId)
  }, [strategy, pairState.activeId, binRange, spotBinId])

  const needsApproveX = parsedAmountX > 0n && approvalX.needsApproval(parsedAmountX)
  const needsApproveY = parsedAmountY > 0n && approvalY.needsApproval(parsedAmountY)
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
      binRange,
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

      {/* Bin Range / Spot Bin */}
      {strategy !== 'spot' ? (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Bin Range</span>
            <span className="text-xs font-mono text-text-secondary">
              {pairState.activeId - binRange}–{pairState.activeId + binRange}{' '}
              <span className="text-text-muted">({binRange * 2 + 1} bins)</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={binRange}
            onChange={(e) => setBinRange(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      ) : (
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

      {/* Distribution Preview */}
      <div className="mb-3">
        <StrategyPreview
          distribution={distribution}
          activeBinId={pairState.activeId}
          binStep={pairState.binStep}
          bins={bins}
          amountX={parsedAmountX}
          amountY={parsedAmountY}
        />
      </div>

      {/* Token Inputs */}
      <div className="space-y-2 mb-4">
        <TokenInput
          label={`${tokenXSymbol} Amount`}
          symbol={tokenXSymbol}
          tokenAddress={pairState.tokenX}
          value={amountX}
          onChange={setAmountX}
        />
        <TokenInput
          label={`${tokenYSymbol} Amount`}
          symbol={tokenYSymbol}
          tokenAddress={pairState.tokenY}
          value={amountY}
          onChange={setAmountY}
        />
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
