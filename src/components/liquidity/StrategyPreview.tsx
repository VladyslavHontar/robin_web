'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { Distribution } from '@/lib/binMath'
import { formatBinPrice } from '@/lib/binMath'
import type { BinData } from '@/hooks/useBinRange'

type StrategyPreviewProps = {
  distribution: Distribution
  activeBinId: number
  binStep: number
  bins: BinData[]
  amountX: bigint
  amountY: bigint
}

const PRECISION = 10n ** 18n
const DEFAULT_PADDING = 5 // extra bins shown on each side by default
const MAX_EXTRA_PADDING = 40 // max extra bins you can zoom out to

type Candle = {
  binId: number
  existing: number
  added: number
  isAdding: boolean
}

export function StrategyPreview({
  distribution,
  activeBinId,
  binStep,
  bins,
  amountX,
  amountY,
}: StrategyPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [extraPadding, setExtraPadding] = useState(DEFAULT_PADDING)

  // The core distribution range (minimum zoom)
  const distRange = useMemo(() => {
    if (distribution.binIds.length === 0) return { min: activeBinId, max: activeBinId }
    const sorted = [...distribution.binIds].sort((a, b) => a - b)
    return { min: sorted[0], max: sorted[sorted.length - 1] }
  }, [distribution.binIds, activeBinId])

  // Build all candle data for the full padded view
  const candles = useMemo(() => {
    const reserveMap = new Map<number, { reserveX: bigint; reserveY: bigint }>()
    for (const bin of bins) {
      reserveMap.set(bin.binId, { reserveX: bin.reserveX, reserveY: bin.reserveY })
    }

    const addingSet = new Set<number>()
    const addAmountMap = new Map<number, { addX: bigint; addY: bigint }>()

    for (let i = 0; i < distribution.binIds.length; i++) {
      const binId = distribution.binIds[i]
      const distX = distribution.distributionX[i]
      const distY = distribution.distributionY[i]

      if (distX > 0n || distY > 0n) {
        const addX = (amountX * distX) / PRECISION
        const addY = (amountY * distY) / PRECISION
        if (addX > 0n || addY > 0n) {
          addingSet.add(binId)
        }
        addAmountMap.set(binId, { addX, addY })
      }
    }

    // View range = distribution range + extraPadding on each side
    const viewMin = Math.max(0, distRange.min - extraPadding)
    const viewMax = Math.min(16_777_215, distRange.max + extraPadding)

    const result: Candle[] = []
    for (let id = viewMin; id <= viewMax; id++) {
      const reserves = reserveMap.get(id)
      const existing = reserves ? Number(reserves.reserveX) + Number(reserves.reserveY) : 0
      const add = addAmountMap.get(id)
      const added = add ? Number(add.addX) + Number(add.addY) : 0

      result.push({
        binId: id,
        existing,
        added,
        isAdding: addingSet.has(id),
      })
    }
    return result
  }, [distribution, bins, amountX, amountY, distRange, extraPadding])

  // Scroll-to-zoom handler
  const scrollAccum = useRef(0)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      // Accumulate scroll delta — only step after threshold to reduce sensitivity
      scrollAccum.current += e.deltaY
      const threshold = 50
      if (Math.abs(scrollAccum.current) < threshold) return
      const steps = Math.trunc(scrollAccum.current / threshold)
      scrollAccum.current -= steps * threshold
      setExtraPadding((prev) =>
        Math.max(0, Math.min(MAX_EXTRA_PADDING, prev + steps)),
      )
    },
    [],
  )

  // Attach wheel listener with passive: false so we can preventDefault
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // D3 render
  useEffect(() => {
    if (!svgRef.current || candles.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current.parentElement
    const width = container?.clientWidth ?? 500
    const height = 200
    const margin = { top: 8, right: 8, bottom: 64, left: 8 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // X scale
    const x = d3
      .scaleBand<number>()
      .domain(candles.map((c) => c.binId))
      .range([0, innerW])
      .padding(0.12)

    // Y scale — only based on actual liquidity (existing + added)
    const yMax = d3.max(candles, (c) => c.existing + c.added) ?? 0
    const y = d3.scaleLinear().domain([0, Math.max(yMax, 1)]).nice().range([innerH, 0])

    // X axis — price label for every bin
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d) => formatBinPrice(d as number, binStep, 4)))
      .attr('color', '#55556a')
      .selectAll('text')
      .attr('font-size', '8px')
      .attr('transform', 'rotate(-55)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.3em')
      .attr('dy', '0.15em')

    // Background shading for the working range
    const firstWorkingX = x(distRange.min)
    const lastWorkingX = x(distRange.max)
    if (firstWorkingX !== undefined && lastWorkingX !== undefined) {
      g.append('rect')
        .attr('x', firstWorkingX)
        .attr('y', 0)
        .attr('width', lastWorkingX + x.bandwidth() - firstWorkingX)
        .attr('height', innerH)
        .attr('fill', '#6366f1')
        .attr('opacity', 0.04)
    }

    const MIN_BAR_PX = 3 // minimum visible height so every bin is visible

    // Existing liquidity (bottom layer) — all bins get at least MIN_BAR_PX
    g.selectAll('.bar-existing')
      .data(candles)
      .enter()
      .append('rect')
      .attr('class', 'bar-existing')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => {
        const h = innerH - y(d.existing)
        return h > MIN_BAR_PX ? y(d.existing) : innerH - MIN_BAR_PX
      })
      .attr('width', x.bandwidth())
      .attr('height', (d) => {
        const h = innerH - y(d.existing)
        return Math.max(h, MIN_BAR_PX)
      })
      .attr('fill', '#2a2a3a')
      .attr('opacity', (d) => (d.existing > 0 ? 0.7 : 0.25))
      .attr('rx', 1)

    // Added liquidity (stacked on top, blue) — only bins with actual deposit
    g.selectAll('.bar-added')
      .data(candles.filter((c) => c.added > 0))
      .enter()
      .append('rect')
      .attr('class', 'bar-added')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => y(d.existing + d.added))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(0, y(d.existing) - y(d.existing + d.added)))
      .attr('fill', '#6366f1')
      .attr('opacity', 0.9)
      .attr('rx', 1)

    // Active bin marker
    if (x(activeBinId) !== undefined) {
      g.append('line')
        .attr('x1', x(activeBinId)! + x.bandwidth() / 2)
        .attr('x2', x(activeBinId)! + x.bandwidth() / 2)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,2')
        .attr('opacity', 0.6)
    }
  }, [candles, activeBinId, binStep, distRange])

  if (candles.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-surface-overlay p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted">Liquidity Preview</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#2a2a3a]" />
            Existing
          </span>
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
            Your deposit
          </span>
        </div>
      </div>
      <div className="relative cursor-ns-resize">
        <svg ref={svgRef} className="w-full" preserveAspectRatio="xMidYMid meet" />
        {extraPadding > 0 && (
          <div className="absolute top-1 right-1 text-[10px] text-text-muted bg-surface-overlay/80 px-1.5 py-0.5 rounded">
            {candles.length} bins shown
          </div>
        )}
      </div>
      {extraPadding > DEFAULT_PADDING && (
        <p className="text-[10px] text-text-muted mt-1 text-center">
          Scroll up to zoom back in
        </p>
      )}
    </div>
  )
}
