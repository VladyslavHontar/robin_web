'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { robinhoodTestnet } from '@/config/chains'

const EXPLORER = robinhoodTestnet.blockExplorers!.default.url

// ── Types ──────────────────────────────────────────────────────────────────────

export type TxStatus = 'pending' | 'success' | 'error'

export type TxToastData = {
  id: string
  txHash: `0x${string}`
  label: string
  status: TxStatus
  errorMsg?: string
}

type ToastCtx = {
  upsert: (toast: TxToastData) => void
}

// ── Context ────────────────────────────────────────────────────────────────────

const Ctx = createContext<ToastCtx | null>(null)

export function useTxToastCtx() {
  return useContext(Ctx) // null-safe — toasts are silently skipped outside provider
}

// ── Individual toast ───────────────────────────────────────────────────────────

const DISMISS_SUCCESS = 5_000
const DISMISS_ERROR   = 8_000

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: TxToastData
  onDismiss: () => void
}) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startedAt   = useRef(0)
  const remaining   = useRef(0)

  const startTimer = useCallback(
    (duration: number) => {
      clearTimeout(timerRef.current)
      startedAt.current = Date.now()
      remaining.current = duration
      timerRef.current = setTimeout(onDismiss, duration)
    },
    [onDismiss],
  )

  // Start auto-dismiss when status settles
  useEffect(() => {
    if (toast.status === 'success') startTimer(DISMISS_SUCCESS)
    if (toast.status === 'error')   startTimer(DISMISS_ERROR)
    return () => clearTimeout(timerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.status])

  function pauseTimer() {
    if (!timerRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = undefined
    remaining.current = Math.max(300, remaining.current - (Date.now() - startedAt.current))
  }

  function resumeTimer() {
    if (timerRef.current) return
    if (remaining.current <= 0) return
    startTimer(remaining.current)
  }

  const isPending = toast.status === 'pending'
  const isSuccess = toast.status === 'success'
  const isError   = toast.status === 'error'

  const accentColor = isSuccess ? '#0DAB76' : isError ? '#ef4444' : '#f59e0b'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      className="relative w-72 rounded-xl border border-border bg-surface-raised/80 backdrop-blur-md p-3.5 shadow-2xl flex gap-3 items-start select-none overflow-hidden"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accentColor }}
      />
      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        {isPending && (
          <svg
            className="w-4 h-4 animate-spin"
            style={{ color: accentColor }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {isSuccess && (
          <svg className="w-4 h-4" style={{ color: accentColor }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        )}
        {isError && (
          <svg className="w-4 h-4" style={{ color: accentColor }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-text-primary leading-snug">
            {toast.label}{' '}
            <span style={{ color: accentColor }}>
              {isPending ? 'pending…' : isSuccess ? 'confirmed' : 'failed'}
            </span>
          </p>
          <button
            onClick={onDismiss}
            className="shrink-0 text-text-muted hover:text-text-secondary transition-colors text-xs leading-none"
          >
            ✕
          </button>
        </div>

        {/* Error message */}
        {isError && toast.errorMsg && (
          <p className="mt-1 text-[10px] text-text-muted leading-snug line-clamp-2">
            {toast.errorMsg.replace(/^.*?reason: /i, '').slice(0, 120)}
          </p>
        )}

        {/* Explorer link */}
        <a
          href={`${EXPLORER}/tx/${toast.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-accent transition-colors"
        >
          View on explorer
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 10 10 2M10 2H5M10 2v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </motion.div>
  )
}

// ── Provider + container ───────────────────────────────────────────────────────

export function TxToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<TxToastData[]>([])

  const upsert = useCallback((toast: TxToastData) => {
    setToasts((prev) => {
      const idx = prev.findIndex((t) => t.id === toast.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = toast
        return next
      }
      return [...prev, toast]
    })
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <Ctx.Provider value={{ upsert }}>
      {children}

      {/* Fixed toast stack — bottom-right */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence initial={false} mode="sync">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
