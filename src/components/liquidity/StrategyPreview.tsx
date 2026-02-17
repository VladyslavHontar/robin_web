'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { Distribution } from '@/lib/binMath'
import { formatBinPrice } from '@/lib/binMath'
import { formatWei } from '@/lib/formatters'
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
  tokenXSymbol: string
  tokenYSymbol: string
  distributionFn: (startBin: number, endBin: number) => Distribution
}

const PRECISION = 10n ** 18n
const DEFAULT_PADDING = 5
const MAX_EXTRA_PADDING = 40
const BAR_RADIUS = 3
const MIN_BAR_PX = 3

type Candle = {
  binId: number
  existingX: number
  existingY: number
  addedX: number
  addedY: number
  existing: number
  added: number
  isAdding: boolean
}

/** SVG path with rounded top corners and flat bottom */
function roundedTopRect(bx: number, by: number, w: number, h: number, r: number): string {
  if (h <= 0 || w <= 0) return `M${bx},${by} Z`
  const radius = Math.min(r, w / 2, h)
  return [
    `M${bx},${by + h}`,
    `V${by + radius}`,
    `Q${bx},${by} ${bx + radius},${by}`,
    `H${bx + w - radius}`,
    `Q${bx + w},${by} ${bx + w},${by + radius}`,
    `V${by + h}`,
    'Z',
  ].join(' ')
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
  tokenXSymbol,
  tokenYSymbol,
  distributionFn,
}: StrategyPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null)
  const prevDomainRef = useRef<string>('')
  const hasRenderedRef = useRef(false)
  const distributionFnRef = useRef(distributionFn)
  distributionFnRef.current = distributionFn
  const amountXRef = useRef(amountX)
  amountXRef.current = amountX
  const amountYRef = useRef(amountY)
  amountYRef.current = amountY
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
      const exX = reserves ? Number(reserves.reserveX) : 0
      const exY = reserves ? Number(reserves.reserveY) : 0
      const add = addAmountMap.get(id)
      const adX = add ? Number(add.addX) : 0
      const adY = add ? Number(add.addY) : 0

      result.push({
        binId: id,
        existingX: exX,
        existingY: exY,
        addedX: adX,
        addedY: adY,
        existing: exX + exY,
        added: adX + adY,
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

    const container = svgRef.current.parentElement
    const width = container?.clientWidth ?? 500
    const height = container?.clientHeight ? Math.max(container.clientHeight, 200) : 200
    const margin = { top: 8, right: 8, bottom: 64, left: 8 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const styles = getComputedStyle(document.documentElement)
    const activeBinColor = styles.getPropertyValue('--color-active-bin').trim() || '#f59e0b'

    const COLOR_EXISTING_Y = '#0B5D1E'
    const COLOR_EXISTING_X = '#0a2912'
    const COLOR_ADDED_Y = '#139A43'
    const COLOR_ADDED_X = '#0DAB76'
    const COLOR_DESELECTED = '#040f07'

    // Check if domain (visible bins) changed — if not, do in-place update
    const domainKey = candles.map((c) => c.binId).join(',')
    const domainChanged = domainKey !== prevDomainRef.current
    prevDomainRef.current = domainKey

    // Y scale (always recompute — values may have changed)
    const yMax = d3.max(candles, (c) => c.existing + c.added) ?? 0
    const y = d3.scaleLinear().domain([0, Math.max(yMax, 1)]).nice().range([innerH, 0])

    // === IN-PLACE UPDATE (same domain — smooth transition, no teardown) ===
    if (!domainChanged) {
      const g = svg.select<SVGGElement>('g')
      const x = xScaleRef.current!
      const bw = x.bandwidth()
      const UPDATE_DURATION = 250
      const UPDATE_EASE = d3.easeCubicOut

      // Update existing-Y
      g.selectAll<SVGPathElement, Candle>('.bar-existing-y')
        .data(candles, (d) => String(d.binId))
        .transition().duration(UPDATE_DURATION).ease(UPDATE_EASE)
        .attr('d', (d) => {
          if (d.existing <= 0) return roundedTopRect(x(d.binId)!, innerH - MIN_BAR_PX, bw, MIN_BAR_PX, BAR_RADIUS)
          const h = innerH - y(d.existingY)
          return roundedTopRect(x(d.binId)!, y(d.existingY), bw, h, BAR_RADIUS)
        })

      // Update existing-X
      g.selectAll<SVGPathElement, Candle>('.bar-existing-x')
        .data(candles.filter((c) => c.existingX > 0), (d) => String(d.binId))
        .transition().duration(UPDATE_DURATION).ease(UPDATE_EASE)
        .attr('d', (d) => {
          const by = y(d.existing)
          const h = y(d.existingY) - by
          return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
        })

      // Update added-Y
      g.selectAll<SVGPathElement, Candle>('.bar-added-y')
        .data(candles, (d) => String(d.binId))
        .transition().duration(UPDATE_DURATION).ease(UPDATE_EASE)
        .attr('d', (d) => {
          if (d.addedY <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
          const baseTop = y(d.existing)
          const addedYH = baseTop - y(d.existing + d.addedY)
          return roundedTopRect(x(d.binId)!, baseTop - addedYH, bw, Math.max(0, addedYH), BAR_RADIUS)
        })
        .attr('opacity', (d) => d.addedY > 0 ? 0.9 : 0)

      // Update added-X
      g.selectAll<SVGPathElement, Candle>('.bar-added-x')
        .data(candles, (d) => String(d.binId))
        .transition().duration(UPDATE_DURATION).ease(UPDATE_EASE)
        .attr('d', (d) => {
          if (d.addedX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
          const by = y(d.existing + d.added)
          const topOfAddedY = y(d.existing + d.addedY)
          const h = topOfAddedY - by
          return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
        })
        .attr('opacity', (d) => d.addedX > 0 ? 0.9 : 0)

      return
    }

    // === FULL REBUILD (domain changed) ===
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // X scale
    const x = d3
      .scaleBand<number>()
      .domain(candles.map((c) => c.binId))
      .range([0, innerW])
      .padding(0.12)

    xScaleRef.current = x

    // X axis — price for every bin
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d) => formatBinPrice(d as number, binStep, 4)))
      .attr('color', '#3d6e48')
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
        .attr('class', 'range-shading')
        .attr('x', firstX)
        .attr('y', 0)
        .attr('width', lastX + x.bandwidth() - firstX)
        .attr('height', innerH)
        .attr('fill', '#0DAB76')
        .attr('opacity', 0.06)
    }

    const bw = x.bandwidth()

    // First render: grow from baseline. Subsequent rebuilds (zoom): instant.
    const isFirstRender = !hasRenderedRef.current
    hasRenderedRef.current = true

    const targetExistingY = (d: Candle) => {
      if (d.existing <= 0) return roundedTopRect(x(d.binId)!, innerH - MIN_BAR_PX, bw, MIN_BAR_PX, BAR_RADIUS)
      const h = innerH - y(d.existingY)
      return roundedTopRect(x(d.binId)!, y(d.existingY), bw, h, BAR_RADIUS)
    }
    const targetExistingX = (d: Candle) => {
      const by = y(d.existing)
      const h = y(d.existingY) - by
      return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
    }
    const targetAddedY = (d: Candle) => {
      if (d.addedY <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const baseTop = y(d.existing)
      const addedYH = baseTop - y(d.existing + d.addedY)
      return roundedTopRect(x(d.binId)!, baseTop - addedYH, bw, Math.max(0, addedYH), BAR_RADIUS)
    }
    const targetAddedX = (d: Candle) => {
      if (d.addedX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const by = y(d.existing + d.added)
      const topOfAddedY = y(d.existing + d.addedY)
      const h = topOfAddedY - by
      return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
    }

    if (isFirstRender) {
      const ENTER_DURATION = 400
      const ENTER_EASE = d3.easeCubicOut
      const baseline = (d: Candle) => roundedTopRect(x(d.binId)!, innerH - MIN_BAR_PX, bw, MIN_BAR_PX, BAR_RADIUS)
      const zeroBar = (d: Candle) => roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)

      g.selectAll('.bar-existing-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-y')
        .attr('d', baseline).attr('fill', COLOR_EXISTING_Y).attr('opacity', 0)
        .transition().duration(ENTER_DURATION).ease(ENTER_EASE)
        .attr('d', targetExistingY)
        .attr('opacity', (d) => (d.existing > 0 ? 0.8 : 0.25))

      g.selectAll('.bar-existing-x')
        .data(candles.filter((c) => c.existingX > 0), (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-x')
        .attr('d', (d) => roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS))
        .attr('fill', COLOR_EXISTING_X).attr('opacity', 0)
        .transition().duration(ENTER_DURATION).ease(ENTER_EASE)
        .attr('d', targetExistingX).attr('opacity', 0.8)

      g.selectAll('.bar-added-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-y')
        .attr('d', zeroBar).attr('fill', COLOR_ADDED_Y).attr('opacity', 0)
        .transition().duration(ENTER_DURATION).ease(ENTER_EASE)
        .attr('d', targetAddedY)
        .attr('opacity', (d) => d.addedY > 0 ? 0.9 : 0)

      g.selectAll('.bar-added-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-x')
        .attr('d', zeroBar).attr('fill', COLOR_ADDED_X).attr('opacity', 0)
        .transition().duration(ENTER_DURATION).ease(ENTER_EASE)
        .attr('d', targetAddedX)
        .attr('opacity', (d) => d.addedX > 0 ? 0.9 : 0)
    } else {
      // Subsequent rebuilds (zoom, etc.) — instant placement, no animation
      g.selectAll('.bar-existing-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-y')
        .attr('d', targetExistingY).attr('fill', COLOR_EXISTING_Y)
        .attr('opacity', (d) => (d.existing > 0 ? 0.8 : 0.25))

      g.selectAll('.bar-existing-x')
        .data(candles.filter((c) => c.existingX > 0), (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-x')
        .attr('d', targetExistingX).attr('fill', COLOR_EXISTING_X).attr('opacity', 0.8)

      g.selectAll('.bar-added-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-y')
        .attr('d', targetAddedY).attr('fill', COLOR_ADDED_Y)
        .attr('opacity', (d) => d.addedY > 0 ? 0.9 : 0)

      g.selectAll('.bar-added-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-x')
        .attr('d', targetAddedX).attr('fill', COLOR_ADDED_X)
        .attr('opacity', (d) => d.addedX > 0 ? 0.9 : 0)
    }

    // Active bin marker
    if (x(activeBinId) !== undefined) {
      g.append('line')
        .attr('x1', x(activeBinId)! + bw / 2)
        .attr('x2', x(activeBinId)! + bw / 2)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', activeBinColor)
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '3,2')
        .attr('opacity', 0.8)
    }

    // Invisible hit areas + tooltip
    if (tooltipRef.current) tooltipRef.current.remove()
    const tooltip = d3
      .select(svgRef.current.parentElement!)
      .append('div')
      .attr('class', 'absolute pointer-events-none bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs hidden')
      .style('z-index', '20')
    tooltipRef.current = tooltip

    g.selectAll('.bar-hitarea')
      .data(candles, (d) => String((d as Candle).binId))
      .enter()
      .append('rect')
      .attr('class', 'bar-hitarea')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', 0)
      .attr('width', bw)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mouseover', function (_event, d) {
        const totalX = d.existingX + d.addedX
        const totalY = d.existingY + d.addedY
        const pctX = totalX > 0 ? ((d.addedX / totalX) * 100).toFixed(1) : '0.0'
        const pctY = totalY > 0 ? ((d.addedY / totalY) * 100).toFixed(1) : '0.0'

        const lines: string[] = [
          `<div class="text-text-muted mb-1">Bin ${d.binId} ${d.binId === activeBinId ? `<span style="color:${activeBinColor}">Active</span>` : ''}</div>`,
          `<div class="text-text-secondary">Price: ${formatBinPrice(d.binId, binStep)}</div>`,
        ]

        const showX = d.existingX > 0 || d.addedX > 0 || d.binId >= activeBinId
        const showY = d.existingY > 0 || d.addedY > 0 || d.binId <= activeBinId

        if (showX) {
          lines.push(`<div class="mt-1" style="color:${COLOR_ADDED_X}">${tokenXSymbol}: ${formatWei(BigInt(d.existingX))}${d.addedX > 0 ? ` <span class="text-text-primary">+ ${formatWei(BigInt(d.addedX))}</span>` : ''}</div>`)
          if (d.addedX > 0) lines.push(`<div class="text-text-muted text-[10px]">Your ${tokenXSymbol}: ${pctX}%</div>`)
        }
        if (showY) {
          lines.push(`<div class="mt-1" style="color:${COLOR_ADDED_Y}">${tokenYSymbol}: ${formatWei(BigInt(d.existingY))}${d.addedY > 0 ? ` <span class="text-text-primary">+ ${formatWei(BigInt(d.addedY))}</span>` : ''}</div>`)
          if (d.addedY > 0) lines.push(`<div class="text-text-muted text-[10px]">Your ${tokenYSymbol}: ${pctY}%</div>`)
        }

        if (d.existing === 0 && d.added === 0) {
          lines.push('<div class="text-text-muted mt-1">Empty bin</div>')
        }

        tooltip.classed('hidden', false).html(`<div class="font-mono">${lines.join('')}</div>`)
      })
      .on('mousemove', function (event) {
        const containerRect = svgRef.current!.parentElement!.getBoundingClientRect()
        tooltip
          .style('left', `${event.clientX - containerRect.left + 12}px`)
          .style('top', `${event.clientY - containerRect.top - 10}px`)
      })
      .on('mouseout', function () {
        tooltip.classed('hidden', true)
      })

    // Draggable boundary handles (only when editable)
    if (editable) {
      const handleColor = '#139A43'

      // Helper to position a handle group at a given xPos
      function positionHandle(
        handle: d3.Selection<SVGGElement, unknown, null, undefined>,
        xPos: number,
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
          : (x(binId) ?? 0) + bw

        const handle = g.append('g')
          .attr('class', `handle-${side}`)
          .style('cursor', 'ew-resize')

        handle.append('line')
          .attr('x1', xPos)
          .attr('x2', xPos)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', handleColor)
          .attr('stroke-width', 2)

        const triSize = 6
        handle.append('path')
          .attr('d', `M${xPos},0 L${xPos - triSize},-${triSize} L${xPos + triSize},-${triSize} Z`)
          .attr('fill', handleColor)

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

      const shadingRect = g.select<SVGRectElement>('.range-shading')

      const DRAG_DURATION = 120
      const DRAG_EASE = d3.easeCubicOut

      // Live-update bars to reflect the dragged range (recalculates distribution)
      function updateBarsForRange(newStart: number, newEnd: number) {
        const sFirstX = x(newStart)
        const sLastX = x(newEnd)
        if (sFirstX !== undefined && sLastX !== undefined) {
          shadingRect
            .transition().duration(DRAG_DURATION).ease(DRAG_EASE)
            .attr('x', sFirstX)
            .attr('width', sLastX + bw - sFirstX)
        }

        // Recalculate distribution for the new range (use refs for fresh values)
        const newDist = distributionFnRef.current(newStart, newEnd)
        const curAmountX = amountXRef.current
        const curAmountY = amountYRef.current
        const addMap = new Map<number, { addX: number; addY: number }>()
        for (let i = 0; i < newDist.binIds.length; i++) {
          const dX = newDist.distributionX[i]
          const dY = newDist.distributionY[i]
          const adX = Number((curAmountX * dX) / PRECISION)
          const adY = Number((curAmountY * dY) / PRECISION)
          addMap.set(newDist.binIds[i], { addX: adX, addY: adY })
        }

        g.selectAll<SVGPathElement, Candle>('.bar-existing-y')
          .transition().duration(DRAG_DURATION).ease(DRAG_EASE)
          .attr('fill', (d) => (d.binId >= newStart && d.binId <= newEnd) ? COLOR_EXISTING_Y : COLOR_DESELECTED)
          .attr('opacity', (d) => {
            const inRange = d.binId >= newStart && d.binId <= newEnd
            if (!inRange) return 0.15
            return d.existing > 0 ? 0.8 : 0.25
          })

        g.selectAll<SVGPathElement, Candle>('.bar-existing-x')
          .transition().duration(DRAG_DURATION).ease(DRAG_EASE)
          .attr('fill', (d) => (d.binId >= newStart && d.binId <= newEnd) ? COLOR_EXISTING_X : COLOR_DESELECTED)
          .attr('opacity', (d) => (d.binId >= newStart && d.binId <= newEnd) ? 0.8 : 0.15)

        // Update added-Y bar geometry and opacity
        g.selectAll<SVGPathElement, Candle>('.bar-added-y')
          .transition().duration(DRAG_DURATION).ease(DRAG_EASE)
          .attr('d', (d) => {
            const add = addMap.get(d.binId)
            const adY = add?.addY ?? 0
            if (adY <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
            const baseTop = y(d.existing)
            const addedYH = baseTop - y(d.existing + adY)
            return roundedTopRect(x(d.binId)!, baseTop - addedYH, bw, Math.max(0, addedYH), BAR_RADIUS)
          })
          .attr('opacity', (d) => {
            const add = addMap.get(d.binId)
            return (add?.addY ?? 0) > 0 ? 0.9 : 0
          })

        // Update added-X bar geometry and opacity
        g.selectAll<SVGPathElement, Candle>('.bar-added-x')
          .transition().duration(DRAG_DURATION).ease(DRAG_EASE)
          .attr('d', (d) => {
            const add = addMap.get(d.binId)
            const adX = add?.addX ?? 0
            const adY = add?.addY ?? 0
            if (adX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
            const totalAdded = adX + adY
            const by = y(d.existing + totalAdded)
            const topOfAddedY = y(d.existing + adY)
            const h = topOfAddedY - by
            return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
          })
          .attr('opacity', (d) => {
            const add = addMap.get(d.binId)
            return (add?.addX ?? 0) > 0 ? 0.9 : 0
          })
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
          positionHandle(leftHandle, x(nearest) ?? 0)
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
          positionHandle(rightHandle, (x(nearest) ?? 0) + bw)
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

  }, [candles, activeBinId, binStep, startBin, endBin, editable, findNearestBin, onRangeChange, tokenXSymbol, tokenYSymbol])

  // Tooltip cleanup on unmount only
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove()
        tooltipRef.current = null
      }
    }
  }, [])

  if (candles.length === 0) return null

  const totalBins = endBin - startBin + 1

  return (
    <div className="rounded-lg border border-border bg-surface-overlay p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-xs text-text-muted">Liquidity Preview</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#0a2912]" />
            {tokenXSymbol}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#0B5D1E]" />
            {tokenYSymbol}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm bg-accent" />
            Your deposit
          </span>
        </div>
      </div>
      <div className="relative cursor-ns-resize flex-1 min-h-0">
        <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="xMidYMid meet" />
        {extraPadding > 0 && (
          <div className="absolute top-1 right-1 text-[10px] text-text-muted bg-surface-overlay/80 px-1.5 py-0.5 rounded">
            {candles.length} bins shown
          </div>
        )}
      </div>

      {/* Range controls below the chart — always rendered for stable layout */}
      <div className={`flex items-center justify-between mt-2 shrink-0 ${editable ? '' : 'invisible'}`}>
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
    </div>
  )
}
