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
  startBin: number
  endBin: number
  onRangeChange: (startBin: number, endBin: number) => void
  editable: boolean
}

const PRECISION = 10n ** 18n
const DEFAULT_PADDING = 5
const MAX_EXTRA_PADDING = 40

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
  startBin,
  endBin,
  onRangeChange,
  editable,
}: StrategyPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [extraPadding, setExtraPadding] = useState(DEFAULT_PADDING)

  // Build candle data
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

    const viewMin = Math.max(0, startBin - extraPadding)
    const viewMax = Math.min(16_777_215, endBin + extraPadding)

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
  }, [distribution, bins, amountX, amountY, startBin, endBin, extraPadding])

  // Scroll-to-zoom
  const scrollAccum = useRef(0)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
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

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Store scale ref for drag handler
  const xScaleRef = useRef<d3.ScaleBand<number> | null>(null)
  // Track drag state locally so we don't re-render mid-gesture
  const draggingRef = useRef<{ side: 'left' | 'right'; currentBin: number } | null>(null)
  const innerHRef = useRef(0)

  // Find nearest bin ID from pixel x position
  const findNearestBin = useCallback((mouseX: number): number | null => {
    const x = xScaleRef.current
    if (!x) return null
    const domain = x.domain()
    const bw = x.bandwidth()
    let closest: number | null = null
    let closestDist = Infinity
    for (const binId of domain) {
      const center = (x(binId) ?? 0) + bw / 2
      const dist = Math.abs(mouseX - center)
      if (dist < closestDist) {
        closestDist = dist
        closest = binId
      }
    }
    return closest
  }, [])

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

    xScaleRef.current = x

    // Y scale
    const yMax = d3.max(candles, (c) => c.existing + c.added) ?? 0
    const y = d3.scaleLinear().domain([0, Math.max(yMax, 1)]).nice().range([innerH, 0])

    // X axis — price for every bin
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

    // Selected range shading
    const firstX = x(startBin)
    const lastX = x(endBin)
    if (firstX !== undefined && lastX !== undefined) {
      g.append('rect')
        .attr('x', firstX)
        .attr('y', 0)
        .attr('width', lastX + x.bandwidth() - firstX)
        .attr('height', innerH)
        .attr('fill', '#6366f1')
        .attr('opacity', 0.06)
    }

    const MIN_BAR_PX = 3

    // Existing liquidity bars
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

    // Added liquidity bars
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

    // Draggable boundary handles (only when editable)
    if (editable) {
      const handleColor = '#818cf8'
      innerHRef.current = innerH

      // Helper to position a handle group at a given xPos
      function positionHandle(
        handle: d3.Selection<SVGGElement, unknown, null, undefined>,
        xPos: number,
        side: 'left' | 'right',
      ) {
        const triSize = 6
        handle.select('line')
          .attr('x1', xPos).attr('x2', xPos)
        handle.select('path')
          .attr('d', `M${xPos},0 L${xPos - triSize},-${triSize} L${xPos + triSize},-${triSize} Z`)
        handle.select('rect')
          .attr('x', xPos - 12)
      }

      // Helper to draw a handle
      function drawHandle(
        binId: number,
        side: 'left' | 'right',
      ) {
        const xPos = side === 'left'
          ? (x(binId) ?? 0)
          : (x(binId) ?? 0) + x.bandwidth()

        const handle = g.append('g')
          .attr('class', `handle-${side}`)
          .style('cursor', 'ew-resize')

        // Vertical line
        handle.append('line')
          .attr('x1', xPos)
          .attr('x2', xPos)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', handleColor)
          .attr('stroke-width', 2)

        // Grab triangle at top
        const triSize = 6
        handle.append('path')
          .attr('d', `M${xPos},0 L${xPos - triSize},-${triSize} L${xPos + triSize},-${triSize} Z`)
          .attr('fill', handleColor)

        // Invisible wider hit area for easier dragging
        handle.append('rect')
          .attr('x', xPos - 12)
          .attr('y', -triSize)
          .attr('width', 24)
          .attr('height', innerH + triSize)
          .attr('fill', 'transparent')

        return handle
      }

      const leftHandle = drawHandle(startBin, 'left')
      const rightHandle = drawHandle(endBin, 'right')

      // Shading rect reference for live updates
      const shadingRect = g.select<SVGRectElement>('rect[fill="#6366f1"][opacity="0.06"]')

      // Live-update bars to reflect the dragged range
      function updateBarsForRange(newStart: number, newEnd: number) {
        // Update shading
        const sFirstX = x(newStart)
        const sLastX = x(newEnd)
        if (sFirstX !== undefined && sLastX !== undefined) {
          shadingRect
            .attr('x', sFirstX)
            .attr('width', sLastX + x.bandwidth() - sFirstX)
        }

        // Grey out / restore existing bars
        g.selectAll<SVGRectElement, Candle>('.bar-existing')
          .attr('fill', (d) => (d.binId >= newStart && d.binId <= newEnd) ? '#2a2a3a' : '#1a1a24')
          .attr('opacity', (d) => {
            const inRange = d.binId >= newStart && d.binId <= newEnd
            if (!inRange) return 0.15
            return d.existing > 0 ? 0.7 : 0.25
          })

        // Show/hide added bars
        g.selectAll<SVGRectElement, Candle>('.bar-added')
          .attr('opacity', (d) => (d.binId >= newStart && d.binId <= newEnd) ? 0.9 : 0)
      }

      // Drag behaviors — update visuals locally, commit only on end
      const dragLeft = d3.drag<SVGGElement, unknown>()
        .on('start', () => {
          draggingRef.current = { side: 'left', currentBin: startBin }
        })
        .on('drag', function (event) {
          const nearest = findNearestBin(event.x)
          if (nearest === null || nearest > endBin) return
          draggingRef.current = { side: 'left', currentBin: nearest }
          positionHandle(leftHandle, x(nearest) ?? 0, 'left')
          updateBarsForRange(nearest, endBin)
        })
        .on('end', () => {
          const drag = draggingRef.current
          draggingRef.current = null
          if (drag) onRangeChange(drag.currentBin, endBin)
        })

      const dragRight = d3.drag<SVGGElement, unknown>()
        .on('start', () => {
          draggingRef.current = { side: 'right', currentBin: endBin }
        })
        .on('drag', function (event) {
          const nearest = findNearestBin(event.x)
          if (nearest === null || nearest < startBin) return
          draggingRef.current = { side: 'right', currentBin: nearest }
          positionHandle(rightHandle, (x(nearest) ?? 0) + x.bandwidth(), 'right')
          updateBarsForRange(startBin, nearest)
        })
        .on('end', () => {
          const drag = draggingRef.current
          draggingRef.current = null
          if (drag) onRangeChange(startBin, drag.currentBin)
        })

      leftHandle.call(dragLeft as never)
      rightHandle.call(dragRight as never)
    }
  }, [candles, activeBinId, binStep, startBin, endBin, editable, findNearestBin, onRangeChange])

  if (candles.length === 0) return null

  const totalBins = endBin - startBin + 1

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

      {/* Range controls below the chart */}
      {editable && (
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onRangeChange(startBin - 1, endBin)}
              className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
            >
              -
            </button>
            <div className="text-xs font-mono text-text-secondary px-1">
              <span className="text-text-muted">Min </span>
              {formatBinPrice(startBin, binStep, 4)}
            </div>
            <button
              onClick={() => { if (startBin < endBin) onRangeChange(startBin + 1, endBin) }}
              className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
            >
              +
            </button>
          </div>

          <span className="text-[10px] text-text-muted">{totalBins} bins</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (endBin > startBin) onRangeChange(startBin, endBin - 1) }}
              className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
            >
              -
            </button>
            <div className="text-xs font-mono text-text-secondary px-1">
              <span className="text-text-muted">Max </span>
              {formatBinPrice(endBin, binStep, 4)}
            </div>
            <button
              onClick={() => onRangeChange(startBin, endBin + 1)}
              className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
