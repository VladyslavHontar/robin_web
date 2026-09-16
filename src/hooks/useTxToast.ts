'use client'

import { useEffect, useRef } from 'react'
import { useTxToastCtx } from '@/components/shared/TxToastProvider'

/**
 * Call inside any write hook to automatically show / update a tx status toast.
 *
 * @param label  Human-readable action name, e.g. "Add Liquidity"
 * @param txHash Hash returned by useWriteContract
 * @param isSuccess  From useWaitForTransactionReceipt
 * @param error      From useWriteContract
 */
export function useTxToast({
  label,
  txHash,
  isSuccess,
  error,
}: {
  label: string
  txHash: `0x${string}` | undefined
  isSuccess: boolean
  error: Error | null
}) {
  const ctx = useTxToastCtx()
  // Keep a stable id so subsequent status updates find the same toast
  const toastId = useRef<string | null>(null)

  useEffect(() => {
    if (!txHash || !ctx) return

    if (!toastId.current) toastId.current = txHash

    const status = isSuccess ? 'success' : error ? 'error' : 'pending'

    ctx.upsert({
      id: toastId.current,
      txHash,
      label,
      status,
      errorMsg: error?.message,
    })
  }, [txHash, isSuccess, error, label, ctx])

  // Reset the stored id when the hook is reset (new tx cycle)
  useEffect(() => {
    if (!txHash) toastId.current = null
  }, [txHash])
}
