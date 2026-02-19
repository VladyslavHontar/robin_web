'use client'

import { useState, useEffect } from 'react'
import { isAddress, type Address } from 'viem'
import { useReadContract } from 'wagmi'
import { useCreatePair, useComputePairAddress } from '@/hooks/useCreatePair'
import { useValidateToken } from '@/hooks/useValidateToken'
import { getBinIdFromPrice } from '@/lib/binMath'
import { lbFactoryAbi } from '@/config/abis/LBFactory'
import { getContracts } from '@/config/contracts'
import { robinhoodTestnet } from '@/config/chains'

const BIN_STEPS = [
  { value: 10,  label: '10bp — Ultra-tight (0.1%)', description: 'Large-cap stocks (AAPL, MSFT)' },
  { value: 50,  label: '50bp — Standard (0.5%)',    description: 'Mid-cap stocks (TSLA, AMZN)' },
  { value: 100, label: '100bp — Wide (1%)',          description: 'Small-cap / volatile stocks'  },
] as const

type BinStep = 10 | 50 | 100

type Props = {
  onClose: () => void
  onCreated?: (pairAddress: Address) => void
}

function TokenStatus({ address, validation }: {
  address: string
  validation: ReturnType<typeof useValidateToken>
}) {
  if (!address || !isAddress(address)) return null

  if (validation.isLoading) {
    return <p className="text-xs mt-1.5 text-text-muted">Verifying token…</p>
  }

  if (validation.error || !validation.isValid) {
    return (
      <p className="text-xs mt-1.5 text-error">
        Not a valid ERC20 token
      </p>
    )
  }

  return (
    <p className="text-xs mt-1.5 text-success">
      {validation.symbol} · {validation.decimals} decimals
    </p>
  )
}

export function CreatePoolModal({ onClose, onCreated }: Props) {
  const [tokenA, setTokenA] = useState('')
  const [tokenB, setTokenB] = useState('')
  const [binStep, setBinStep] = useState<BinStep>(50)
  const [initialPrice, setInitialPrice] = useState('')

  const priceNum = parseFloat(initialPrice)
  const validPrice = initialPrice !== '' && isFinite(priceNum) && priceNum > 0
  const activeId = validPrice ? getBinIdFromPrice(priceNum, binStep) : undefined

  const { createPair, newPairAddress, isLoading, isSuccess, error } = useCreatePair()

  const validationA = useValidateToken(tokenA)
  const validationB = useValidateToken(tokenB)

  const { factory } = getContracts(robinhoodTestnet.id)

  const validA = isAddress(tokenA)
  const validB = isAddress(tokenB)
  const isDuplicate = validA && validB && tokenA.toLowerCase() === tokenB.toLowerCase()

  // Check on-chain whether this pair already exists
  const { data: existingPair } = useReadContract({
    address: factory,
    abi: lbFactoryAbi,
    functionName: 'getPair',
    args: validA && validB && !isDuplicate ? [tokenA as Address, tokenB as Address, binStep] : undefined,
    query: { enabled: validA && validB && !isDuplicate },
    chainId: robinhoodTestnet.id,
  })

  const pairAlreadyExists =
    !!existingPair && existingPair !== '0x0000000000000000000000000000000000000000'

  const canSubmit =
    validA && validB &&
    validationA.isValid && validationB.isValid &&
    !isDuplicate && !pairAlreadyExists && validPrice && !isLoading

  // Derived address shown to user before they create the pool
  const { data: predicted } = useComputePairAddress(
    validA ? (tokenA as Address) : undefined,
    validB ? (tokenB as Address) : undefined,
    binStep,
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || activeId === undefined) return
    await createPair({ tokenA: tokenA as Address, tokenB: tokenB as Address, binStep, activeId })
  }

  // Persist pool to DB and notify parent when pair is created
  useEffect(() => {
    if (isSuccess && newPairAddress) {
      fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairAddress: newPairAddress,
          tokenX: tokenA,
          tokenY: tokenB,
          binStep,
        }),
      }).catch(() => {}) // best-effort persist

      onCreated?.(newPairAddress)
    }
  }, [isSuccess, newPairAddress, onCreated, tokenA, tokenB, binStep])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-raised border border-border rounded-xl w-full max-w-lg mx-4 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Create New Pool</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Token A */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Token A</label>
            <input
              type="text"
              value={tokenA}
              onChange={e => setTokenA(e.target.value.trim())}
              placeholder="0x… token address"
              className={`w-full bg-surface-overlay border rounded-lg px-3 py-2 text-sm text-text-primary
                         placeholder-text-muted focus:outline-none font-mono transition-colors ${
                           tokenA && validA && !validationA.isLoading
                             ? validationA.isValid
                               ? 'border-success/30 focus:border-success'
                               : 'border-error/30 focus:border-error'
                             : 'border-border focus:border-accent'
                         }`}
            />
            <TokenStatus address={tokenA} validation={validationA} />
          </div>

          {/* Token B */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Token B</label>
            <input
              type="text"
              value={tokenB}
              onChange={e => setTokenB(e.target.value.trim())}
              placeholder="0x… token address"
              className={`w-full bg-surface-overlay border rounded-lg px-3 py-2 text-sm text-text-primary
                         placeholder-text-muted focus:outline-none font-mono transition-colors ${
                           tokenB && validB && !validationB.isLoading
                             ? validationB.isValid
                               ? 'border-success/30 focus:border-success'
                               : 'border-error/30 focus:border-error'
                             : 'border-border focus:border-accent'
                         }`}
            />
            <TokenStatus address={tokenB} validation={validationB} />
          </div>

          {/* Duplicate warning */}
          {isDuplicate && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-3">
              <p className="text-xs text-error">Token A and Token B cannot be the same address</p>
            </div>
          )}

          {/* Pool already exists warning */}
          {pairAlreadyExists && !isDuplicate && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-1">
              <p className="text-xs text-warning font-medium">Pool already exists</p>
              <p className="text-xs font-mono text-warning/80 break-all">{existingPair}</p>
            </div>
          )}

          {/* Bin step */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Bin step (price granularity)</label>
            <div className="space-y-2">
              {BIN_STEPS.map(({ value, label, description }) => (
                <label key={value} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="binStep"
                    value={value}
                    checked={binStep === value}
                    onChange={() => setBinStep(value as BinStep)}
                    className="mt-0.5 accent-accent"
                  />
                  <div>
                    <p className="text-sm text-text-primary group-hover:text-accent transition-colors">{label}</p>
                    <p className="text-xs text-text-muted">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Initial price */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Initial price
              <span className="text-text-muted font-normal"> — units of Token B per Token A</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={initialPrice}
              onChange={e => setInitialPrice(e.target.value)}
              placeholder="e.g. 195.50"
              className={`w-full bg-surface-overlay border rounded-lg px-3 py-2 text-sm text-text-primary
                         placeholder-text-muted focus:outline-none transition-colors ${
                           initialPrice !== ''
                             ? validPrice
                               ? 'border-success/30 focus:border-success'
                               : 'border-error/30 focus:border-error'
                             : 'border-border focus:border-accent'
                         }`}
            />
            {validPrice && activeId !== undefined && (
              <p className="text-xs mt-1.5 text-text-muted">
                Bin <span className="text-text-secondary font-mono">{activeId}</span>
                {' · '}1 Token A = {priceNum.toLocaleString(undefined, { maximumFractionDigits: 8 })} Token B
              </p>
            )}
            {initialPrice !== '' && !validPrice && (
              <p className="text-xs mt-1.5 text-error">Enter a positive number</p>
            )}
          </div>

          {/* Predicted address */}
          {predicted && predicted !== '0x0000000000000000000000000000000000000000' && !isDuplicate && (
            <div className="bg-surface-overlay rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-1">Pool address</p>
              <p className="text-xs font-mono text-accent break-all">{predicted}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-3">
              <p className="text-xs text-error">{error.message.split('\n')[0]}</p>
            </div>
          )}

          {/* Success */}
          {isSuccess && newPairAddress && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <p className="text-xs text-success mb-1">Pool created!</p>
              <p className="text-xs font-mono text-success break-all">{newPairAddress}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border
                         text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-accent text-white font-medium
                         hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating…' : 'Create Pool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
