'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

type ScrollPickerProps = {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

export function ScrollPicker({ value, onChange, min, max, step, format }: ScrollPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastY = useRef(0)
  const accum = useRef(0)
  const [isActive, setIsActive] = useState(false)

  const clamp = useCallback(
    (v: number) => Math.round(Math.min(max, Math.max(min, v)) / step) * step,
    [min, max, step],
  )

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    lastY.current = e.clientY
    accum.current = 0
    setIsActive(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const dy = lastY.current - e.clientY // up = positive
      lastY.current = e.clientY
      accum.current += dy

      const threshold = 8 // pixels per step
      const steps = Math.trunc(accum.current / threshold)
      if (steps !== 0) {
        accum.current -= steps * threshold
        onChange(clamp(value + steps * step))
      }
    },
    [value, onChange, clamp, step],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
    setIsActive(false)
  }, [])

  // Scroll wheel support
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      onChange(clamp(value + dir * step))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value, onChange, clamp, step])

  const display = format ? format(value) : value.toFixed(1)

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`
        relative select-none cursor-ns-resize
        w-11 h-7 rounded-md
        bg-surface border border-border
        flex items-center justify-center
        text-[10px] font-mono
        transition-colors
        ${isActive ? 'border-accent text-text-primary' : 'text-text-secondary'}
      `}
    >
      {/* Top/bottom fade hints */}
      <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-md bg-gradient-to-b from-text-muted/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-1.5 rounded-b-md bg-gradient-to-t from-text-muted/10 to-transparent pointer-events-none" />
      {display}
    </div>
  )
}
