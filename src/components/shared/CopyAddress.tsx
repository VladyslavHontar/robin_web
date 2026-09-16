'use client'

import { useState, useCallback } from 'react'
import { truncateAddress } from '@/lib/formatters'

export function CopyAddress({ address, chars = 4, iconOnly = false }: { address: string; chars?: number; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [address])

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary font-mono text-xs transition-colors cursor-pointer"
      title={address}
    >
      {!iconOnly && truncateAddress(address, chars)}
      <span className="text-[10px]">{copied ? '✓' : '⧉'}</span>
    </button>
  )
}
