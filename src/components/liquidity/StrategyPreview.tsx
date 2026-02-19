'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { Distribution } from '@/lib/binMath'
import { formatBinPrice, getPriceFromBinId } from '@/lib/binMath'
import { formatWei } from '@/lib/formatters'
import type { BinData } from '@/hooks/useBinRange'

/** Per-bin overlay fraction (0–1 of that bin's reserve to highlight) */
export type OverlayBin = { binId: number; fractionX: number; fractionY: number }

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
  /** Optional overlay — shown as a highlight on top of existing bars */
  overlayBins?: OverlayBin[]
  /** CSS color for the overlay (hex or CSS var value). Default: error red */
  overlayColor?: string
  /** Legend label for the overlay (e.g. "to remove", "consumed") */
  overlayLabel?: string
  /** Bin IDs where the connected wallet has LP positions (shows blue arrow indicators) */
  userBinIds?: number[]
  /** Per-bin share data for tooltip display */
  userShareMap?: Map<number, { shares: bigint; totalShares: bigint; estimatedX: bigint; estimatedY: bigint }>
}

const PRECISION = 10n ** 18n
const DEFAULT_PADDING = 5
const MAX_EXTRA_PADDING = 40
const BAR_RADIUS = 3
const MIN_BAR_PX = 3

type Candle = {
  binId: number
  // Raw amounts (for tooltips)
  existingX: number
  existingY: number
  addedX: number
  addedY: number
  // Normalized to Y-value (for bar heights — X amounts converted via bin price)
  normExistingX: number
  normExistingY: number
  normAddedX: number
  normAddedY: number
  normOverlayX: number  // fraction of normExistingX to highlight
  normOverlayY: number  // fraction of normExistingY to highlight
  existing: number // normalized existing total
  added: number    // normalized added total
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
  overlayBins,
  overlayColor = '#ef4444',
  overlayLabel,
  userBinIds = [],
  userShareMap,
}: StrategyPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null)
  const prevDomainRef = useRef<string>('')
  const hasRenderedRef = useRef(false)
  const prevEditableRef = useRef(editable)
  const prevActiveBinRef = useRef(activeBinId)
  const distributionFnRef = useRef(distributionFn)
  distributionFnRef.current = distributionFn
  const amountXRef = useRef(amountX)
  amountXRef.current = amountX
  const amountYRef = useRef(amountY)
  amountYRef.current = amountY
  const userShareMapRef = useRef<Map<number, { shares: bigint; totalShares: bigint; estimatedX: bigint; estimatedY: bigint }>>(new Map())
  userShareMapRef.current = userShareMap ?? new Map()
  const [extraPadding, setExtraPadding] = useState(DEFAULT_PADDING)
  const [renderTick, setRenderTick] = useState(0)

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

    // Use a single price (active bin) for normalization so equal shares = equal bars
    const activePrice = getPriceFromBinId(activeBinId, binStep)

    // Build overlay lookup
    const overlayMap = new Map<number, OverlayBin>()
    if (overlayBins) for (const o of overlayBins) overlayMap.set(o.binId, o)

    const result: Candle[] = []
    for (let id = viewMin; id <= viewMax; id++) {
      const reserves = reserveMap.get(id)
      const exX = reserves ? Number(reserves.reserveX) : 0
      const exY = reserves ? Number(reserves.reserveY) : 0
      const add = addAmountMap.get(id)
      const adX = add ? Number(add.addX) : 0
      const adY = add ? Number(add.addY) : 0

      // Normalize X amounts to Y-equivalent using ACTIVE bin price (constant)
      const normExX = exX * activePrice
      const normExY = exY
      const normAdX = adX * activePrice
      const normAdY = adY

      const ov = overlayMap.get(id)
      const normOvX = ov ? normExX * ov.fractionX : 0
      const normOvY = ov ? normExY * ov.fractionY : 0

      result.push({
        binId: id,
        existingX: exX,
        existingY: exY,
        addedX: adX,
        addedY: adY,
        normExistingX: normExX,
        normExistingY: normExY,
        normAddedX: normAdX,
        normAddedY: normAdY,
        normOverlayX: normOvX,
        normOverlayY: normOvY,
        existing: normExX + normExY,
        added: normAdX + normAdY,
        isAdding: addingSet.has(id),
      })
    }
    return result
  }, [distribution, bins, amountX, amountY, startBin, endBin, extraPadding, binStep, overlayBins])

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

  // Force full D3 rebuild when container first gets real pixel dimensions.
  // Without this, clientWidth=0 on first paint → bars render at zero size and
  // CSS variable colors are never applied correctly.
  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    let lastWidth = 0
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0 && w !== lastWidth) {
        lastWidth = w
        prevDomainRef.current = ''
        hasRenderedRef.current = false
        setRenderTick((k) => k + 1)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Store scale ref for drag handler
  const xScaleRef = useRef<d3.ScaleBand<number> | null>(null)
  const draggingRef = useRef<{ side: 'left' | 'right'; currentBin: number } | null>(null)

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
    const rawH = container?.clientHeight ?? 0
    const height = rawH > 50 ? rawH : 300
    const margin = { top: 8, right: 8, bottom: 64, left: 8 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    const styles = getComputedStyle(document.documentElement)
    const activeBinColor = styles.getPropertyValue('--color-active-bin').trim() || '#76fff4'
    const COLOR_ADDED_X    = styles.getPropertyValue('--color-reserve-x').trim() || '#0DAB76'
    const COLOR_ADDED_Y    = styles.getPropertyValue('--color-reserve-y').trim() || '#3b874c'
    const COLOR_EXISTING_X = COLOR_ADDED_X
    const COLOR_EXISTING_Y = COLOR_ADDED_Y
    const COLOR_DESELECTED = '#040f07'
    const activePrice = getPriceFromBinId(activeBinId, binStep)

    // Dim existing bars only when user is actively adding liquidity
    const isAdding = candles.some((c) => c.added > 0)
    const EXIST_OPACITY      = isAdding ? 0.2  : 0.8
    const EXIST_OPACITY_EMPTY = isAdding ? 0.12 : 0.25

    // If editability changed (e.g. switching to/from Swap mode), force a full
    // rebuild so handles are added or removed from the SVG DOM correctly.
    if (prevEditableRef.current !== editable) {
      prevEditableRef.current = editable
      prevDomainRef.current = ''
      hasRenderedRef.current = false
    }

    // If the active bin changed (e.g. after a cross-bin swap), force a full
    // rebuild so the active bin marker line moves and bar-existing-x elements
    // are created for the new active bin (in-place path can't enter new elements).
    if (prevActiveBinRef.current !== activeBinId) {
      prevActiveBinRef.current = activeBinId
      prevDomainRef.current = ''
      hasRenderedRef.current = false
    }

    // Check if domain (visible bins) changed
    const domainKey = candles.map((c) => c.binId).join(',')
    const domainChanged = domainKey !== prevDomainRef.current
    prevDomainRef.current = domainKey

    // Y scale
    const yMax = d3.max(candles, (c) => c.existing + c.added) ?? 0
    const y = d3.scaleLinear().domain([0, Math.max(yMax, 1)]).nice().range([innerH, 0])

    // ── Geometry helpers ──────────────────────────────────────────────────
    // Stacking order (bottom → top): existingY | addedY | existingX | addedX
    // This groups all Y together and all X together.

    const targetExistingY = (d: Candle) => {
      if (d.existing <= 0 && d.added <= 0)
        return roundedTopRect(x(d.binId)!, innerH - MIN_BAR_PX, bw, MIN_BAR_PX, BAR_RADIUS)
      const h = innerH - y(d.normExistingY)
      return roundedTopRect(x(d.binId)!, y(d.normExistingY), bw, Math.max(0, h), BAR_RADIUS)
    }

    const targetAddedY = (d: Candle) => {
      if (d.normAddedY <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const totalY = d.normExistingY + d.normAddedY
      const h = y(d.normExistingY) - y(totalY)
      return roundedTopRect(x(d.binId)!, y(totalY), bw, Math.max(0, h), BAR_RADIUS)
    }

    const targetExistingX = (d: Candle) => {
      if (d.normExistingX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const totalY = d.normExistingY + d.normAddedY
      const by = y(totalY + d.normExistingX)
      const h = y(totalY) - by
      return roundedTopRect(x(d.binId)!, by, bw, Math.max(0, h), BAR_RADIUS)
    }

    const targetAddedX = (d: Candle) => {
      if (d.normAddedX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const totalY = d.normExistingY + d.normAddedY
      const totalYExX = totalY + d.normExistingX
      const h = y(totalYExX) - y(totalYExX + d.normAddedX)
      return roundedTopRect(x(d.binId)!, y(totalYExX + d.normAddedX), bw, Math.max(0, h), BAR_RADIUS)
    }

    // Overlay — top portion of existing bars, colored distinctly
    const targetOverlayY = (d: Candle) => {
      if (d.normOverlayY <= 0 || d.normExistingY <= 0)
        return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const topY = y(d.normExistingY)
      const h = Math.max(0, y(d.normExistingY - d.normOverlayY) - topY)
      return roundedTopRect(x(d.binId)!, topY, bw, h, BAR_RADIUS)
    }

    const targetOverlayX = (d: Candle) => {
      if (d.normOverlayX <= 0 || d.normExistingX <= 0)
        return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
      const totalY = d.normExistingY + d.normAddedY
      const topOfX = y(totalY + d.normExistingX)
      const h = Math.max(0, y(totalY + d.normExistingX - d.normOverlayX) - topOfX)
      return roundedTopRect(x(d.binId)!, topOfX, bw, h, BAR_RADIUS)
    }

    const COLOR_OVERLAY = overlayColor.startsWith('var(')
      ? (styles.getPropertyValue(overlayColor.slice(4, -1).trim()).trim() || '#ef4444')
      : overlayColor

    const userBinSet = new Set(userBinIds)

    // Hack: x and bw are needed in targetExistingY etc but only defined after domain check.
    // We define a placeholder and set it properly in each branch.
    let x: d3.ScaleBand<number>
    let bw: number

    // === IN-PLACE UPDATE (same domain — smooth transition) ===
    if (!domainChanged) {
      x = xScaleRef.current!
      bw = x.bandwidth()
      const g = svg.select<SVGGElement>('g')
      const DUR = 250
      const EASE = d3.easeCubicOut

      // 1. existing-Y (bottom)
      g.selectAll<SVGPathElement, Candle>('.bar-existing-y')
        .data(candles, (d) => String(d.binId))
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetExistingY)
        .attr('opacity', (d) => d.existing > 0 ? EXIST_OPACITY : EXIST_OPACITY_EMPTY)

      // 2. added-Y (on top of existing-Y)
      g.selectAll<SVGPathElement, Candle>('.bar-added-y')
        .data(candles, (d) => String(d.binId))
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetAddedY)
        .attr('opacity', (d) => d.normAddedY > 0 ? 0.9 : 0)

      // 3. existing-X (on top of all Y)
      g.selectAll<SVGPathElement, Candle>('.bar-existing-x')
        .data(candles, (d) => String(d.binId))
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetExistingX)
        .attr('opacity', (d) => d.normExistingX > 0 ? EXIST_OPACITY : 0)

      // 4. added-X (on top of existing-X)
      g.selectAll<SVGPathElement, Candle>('.bar-added-x')
        .data(candles, (d) => String(d.binId))
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetAddedX)
        .attr('opacity', (d) => d.normAddedX > 0 ? 0.9 : 0)

      // 5. overlay-Y (also update fill in case overlayColor changed between modes)
      g.selectAll<SVGPathElement, Candle>('.bar-overlay-y')
        .data(candles, (d) => String(d.binId))
        .attr('fill', COLOR_OVERLAY)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetOverlayY)
        .attr('opacity', (d) => d.normOverlayY > 0 ? 0.75 : 0)

      // 6. overlay-X
      g.selectAll<SVGPathElement, Candle>('.bar-overlay-x')
        .data(candles, (d) => String(d.binId))
        .attr('fill', COLOR_OVERLAY)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetOverlayX)
        .attr('opacity', (d) => d.normOverlayX > 0 ? 0.75 : 0)

      // 7. user position markers
      const markerPathFn = (d: Candle) => {
        const cx = (x(d.binId) ?? 0) + bw / 2
        const ty = d.existing > 0 ? y(d.existing) - 4 : Math.max(0, innerH - 20)
        return `M${cx},${ty} L${cx - 4},${ty - 6} L${cx + 4},${ty - 6} Z`
      }
      const userMarkerData = candles.filter((c) => userBinSet.has(c.binId))
      const markerSel = g.selectAll<SVGPathElement, Candle>('.bin-user-marker')
        .data(userMarkerData, (d) => String(d.binId))
      markerSel.enter().append('path').attr('class', 'bin-user-marker')
        .attr('fill', '#60a5fa').attr('opacity', 0.9).style('pointer-events', 'none')
        .attr('d', markerPathFn)
      markerSel.transition().duration(DUR).ease(EASE).attr('d', markerPathFn)
      markerSel.exit().remove()

      return
    }

    // === FULL REBUILD (domain changed) ===
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    x = d3
      .scaleBand<number>()
      .domain(candles.map((c) => c.binId))
      .range([0, innerW])
      .padding(0.12)

    xScaleRef.current = x
    bw = x.bandwidth()

    // X axis
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

    // Range shading
    const firstX = x(startBin)
    const lastX = x(endBin)
    if (firstX !== undefined && lastX !== undefined) {
      g.append('rect')
        .attr('class', 'range-shading')
        .attr('x', firstX)
        .attr('y', 0)
        .attr('width', lastX + bw - firstX)
        .attr('height', innerH)
        .attr('fill', '#0DAB76')
        .attr('opacity', 0.06)
    }

    const isFirstRender = !hasRenderedRef.current
    hasRenderedRef.current = true

    if (isFirstRender) {
      const DUR = 400
      const EASE = d3.easeCubicOut
      const baseline = (d: Candle) => roundedTopRect(x(d.binId)!, innerH - MIN_BAR_PX, bw, MIN_BAR_PX, BAR_RADIUS)
      const zeroBar  = (d: Candle) => roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)

      // 1. existing-Y (bottom)
      g.selectAll('.bar-existing-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-y')
        .attr('d', baseline).attr('fill', COLOR_EXISTING_Y).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetExistingY)
        .attr('opacity', (d) => d.existing > 0 ? EXIST_OPACITY : EXIST_OPACITY_EMPTY)

      // 2. added-Y (on top of existing-Y)
      g.selectAll('.bar-added-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-y')
        .attr('d', zeroBar).attr('fill', COLOR_ADDED_Y).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetAddedY)
        .attr('opacity', (d) => d.normAddedY > 0 ? 0.9 : 0)

      // 3. existing-X (on top of all Y)
      g.selectAll('.bar-existing-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-x')
        .attr('d', zeroBar).attr('fill', COLOR_EXISTING_X).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetExistingX)
        .attr('opacity', (d) => d.normExistingX > 0 ? EXIST_OPACITY : 0)

      // 4. added-X (on top of existing-X)
      g.selectAll('.bar-added-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-x')
        .attr('d', zeroBar).attr('fill', COLOR_ADDED_X).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetAddedX)
        .attr('opacity', (d) => d.normAddedX > 0 ? 0.9 : 0)

      // 5. overlay-Y
      g.selectAll('.bar-overlay-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-overlay-y')
        .attr('d', zeroBar).attr('fill', COLOR_OVERLAY).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetOverlayY)
        .attr('opacity', (d) => d.normOverlayY > 0 ? 0.75 : 0)

      // 6. overlay-X
      g.selectAll('.bar-overlay-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-overlay-x')
        .attr('d', zeroBar).attr('fill', COLOR_OVERLAY).attr('opacity', 0)
        .transition().duration(DUR).ease(EASE)
        .attr('d', targetOverlayX)
        .attr('opacity', (d) => d.normOverlayX > 0 ? 0.75 : 0)

      // 7. user position markers (animated in)
      const markerPathFn = (d: Candle) => {
        const cx = (x(d.binId) ?? 0) + bw / 2
        const ty = d.existing > 0 ? y(d.existing) - 4 : Math.max(0, innerH - 20)
        return `M${cx},${ty} L${cx - 4},${ty - 6} L${cx + 4},${ty - 6} Z`
      }
      g.selectAll('.bin-user-marker')
        .data(candles.filter((d) => userBinSet.has((d as Candle).binId)), (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bin-user-marker')
        .attr('fill', '#60a5fa').attr('opacity', 0).style('pointer-events', 'none')
        .attr('d', markerPathFn)
        .transition().duration(DUR).ease(EASE)
        .attr('opacity', 0.9)

    } else {
      // Zoom rebuild — instant placement

      // 1. existing-Y (bottom)
      g.selectAll('.bar-existing-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-y')
        .attr('d', targetExistingY).attr('fill', COLOR_EXISTING_Y)
        .attr('opacity', (d) => d.existing > 0 ? EXIST_OPACITY : EXIST_OPACITY_EMPTY)

      // 2. added-Y (on top of existing-Y)
      g.selectAll('.bar-added-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-y')
        .attr('d', targetAddedY).attr('fill', COLOR_ADDED_Y)
        .attr('opacity', (d) => d.normAddedY > 0 ? 0.9 : 0)

      // 3. existing-X (on top of all Y)
      g.selectAll('.bar-existing-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-existing-x')
        .attr('d', targetExistingX).attr('fill', COLOR_EXISTING_X)
        .attr('opacity', (d) => d.normExistingX > 0 ? EXIST_OPACITY : 0)

      // 4. added-X (on top of existing-X)
      g.selectAll('.bar-added-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-added-x')
        .attr('d', targetAddedX).attr('fill', COLOR_ADDED_X)
        .attr('opacity', (d) => d.normAddedX > 0 ? 0.9 : 0)

      // 5. overlay-Y
      g.selectAll('.bar-overlay-y')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-overlay-y')
        .attr('d', targetOverlayY).attr('fill', COLOR_OVERLAY)
        .attr('opacity', (d) => d.normOverlayY > 0 ? 0.75 : 0)

      // 6. overlay-X
      g.selectAll('.bar-overlay-x')
        .data(candles, (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bar-overlay-x')
        .attr('d', targetOverlayX).attr('fill', COLOR_OVERLAY)
        .attr('opacity', (d) => d.normOverlayX > 0 ? 0.75 : 0)

      // 7. user position markers (instant)
      const markerPathFn = (d: Candle) => {
        const cx = (x(d.binId) ?? 0) + bw / 2
        const ty = d.existing > 0 ? y(d.existing) - 4 : Math.max(0, innerH - 20)
        return `M${cx},${ty} L${cx - 4},${ty - 6} L${cx + 4},${ty - 6} Z`
      }
      g.selectAll('.bin-user-marker')
        .data(candles.filter((d) => userBinSet.has((d as Candle).binId)), (d) => String((d as Candle).binId))
        .enter().append('path').attr('class', 'bin-user-marker')
        .attr('fill', '#60a5fa').attr('opacity', 0.9).style('pointer-events', 'none')
        .attr('d', markerPathFn)
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

    // Tooltip
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

        const userPos = userShareMapRef.current.get(d.binId)
        if (userPos && userPos.totalShares > 0n) {
          const pct = (Number(userPos.shares) * 100 / Number(userPos.totalShares)).toFixed(2)
          const parts: string[] = []
          if (userPos.estimatedX > 0n) parts.push(`${formatWei(userPos.estimatedX)} ${tokenXSymbol}`)
          if (userPos.estimatedY > 0n) parts.push(`${formatWei(userPos.estimatedY)} ${tokenYSymbol}`)
          lines.push(`<div class="mt-1" style="color:#60a5fa">Your share: ${pct}%</div>`)
          if (parts.length > 0) {
            lines.push(`<div class="text-[10px]" style="color:#93c5fd">${parts.join(' + ')}</div>`)
          }
        }

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

    // Draggable boundary handles
    if (editable) {
      const handleColor = '#139A43'

      function positionHandle(
        handle: d3.Selection<SVGGElement, unknown, null, undefined>,
        xPos: number,
      ) {
        const triSize = 6
        handle.select('line').attr('x1', xPos).attr('x2', xPos)
        handle.select('path').attr('d', `M${xPos},0 L${xPos - triSize},-${triSize} L${xPos + triSize},-${triSize} Z`)
        handle.select('rect').attr('x', xPos - 12)
      }

      function drawHandle(binId: number, side: 'left' | 'right') {
        const xPos = side === 'left' ? (x(binId) ?? 0) : (x(binId) ?? 0) + bw
        const handle = g.append('g').attr('class', `handle-${side}`).style('cursor', 'ew-resize')
        const triSize = 6

        handle.append('line')
          .attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', innerH)
          .attr('stroke', handleColor).attr('stroke-width', 2)

        handle.append('path')
          .attr('d', `M${xPos},0 L${xPos - triSize},-${triSize} L${xPos + triSize},-${triSize} Z`)
          .attr('fill', handleColor)

        handle.append('rect')
          .attr('x', xPos - 12).attr('y', -triSize).attr('width', 24).attr('height', innerH + triSize)
          .attr('fill', 'transparent')

        return handle
      }

      const leftHandle  = drawHandle(startBin, 'left')
      const rightHandle = drawHandle(endBin, 'right')
      const shadingRect = g.select<SVGRectElement>('.range-shading')
      const DRAG_DUR  = 120
      const DRAG_EASE = d3.easeCubicOut

      function updateBarsForRange(newStart: number, newEnd: number) {
        const sFirstX = x(newStart)
        const sLastX  = x(newEnd)
        if (sFirstX !== undefined && sLastX !== undefined) {
          shadingRect
            .transition().duration(DRAG_DUR).ease(DRAG_EASE)
            .attr('x', sFirstX)
            .attr('width', sLastX + bw - sFirstX)
        }

        const newDist = distributionFnRef.current(newStart, newEnd)
        const curAmountX = amountXRef.current
        const curAmountY = amountYRef.current
        const addMap = new Map<number, { normAddX: number; normAddY: number }>()
        for (let i = 0; i < newDist.binIds.length; i++) {
          const binId = newDist.binIds[i]
          const dX = newDist.distributionX[i]
          const dY = newDist.distributionY[i]
          const rawAdX = Number((curAmountX * dX) / PRECISION)
          const rawAdY = Number((curAmountY * dY) / PRECISION)
          addMap.set(binId, {
            normAddX: rawAdX * activePrice,
            normAddY: rawAdY,
          })
        }

        // existing-Y
        // In add mode: dim bins outside the range (they won't receive liquidity).
        // In remove mode (isAdding=false): all existing bins stay at full opacity —
        // only the overlay (red) indicates what will be removed.
        g.selectAll<SVGPathElement, Candle>('.bar-existing-y')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('fill', (d) => {
            if (!isAdding) return COLOR_EXISTING_Y
            return (d.binId >= newStart && d.binId <= newEnd) ? COLOR_EXISTING_Y : COLOR_DESELECTED
          })
          .attr('opacity', (d) => {
            const inRange = d.binId >= newStart && d.binId <= newEnd
            if (!inRange && isAdding) return 0.08
            return d.existing > 0 ? EXIST_OPACITY : EXIST_OPACITY_EMPTY
          })

        // added-Y (on top of existing-Y)
        g.selectAll<SVGPathElement, Candle>('.bar-added-y')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('d', (d) => {
            const adY = addMap.get(d.binId)?.normAddY ?? 0
            if (adY <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
            const totalY = d.normExistingY + adY
            const h = y(d.normExistingY) - y(totalY)
            return roundedTopRect(x(d.binId)!, y(totalY), bw, Math.max(0, h), BAR_RADIUS)
          })
          .attr('opacity', (d) => (addMap.get(d.binId)?.normAddY ?? 0) > 0 ? 0.9 : 0)

        // existing-X (on top of all Y)
        g.selectAll<SVGPathElement, Candle>('.bar-existing-x')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('fill', (d) => {
            if (!isAdding) return COLOR_EXISTING_X
            return (d.binId >= newStart && d.binId <= newEnd) ? COLOR_EXISTING_X : COLOR_DESELECTED
          })
          .attr('opacity', (d) => {
            if (!isAdding) return EXIST_OPACITY
            return (d.binId >= newStart && d.binId <= newEnd) ? EXIST_OPACITY : 0.08
          })

        // added-X (on top of existing-X)
        g.selectAll<SVGPathElement, Candle>('.bar-added-x')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('d', (d) => {
            const adX = addMap.get(d.binId)?.normAddX ?? 0
            const adY = addMap.get(d.binId)?.normAddY ?? 0
            if (adX <= 0) return roundedTopRect(x(d.binId)!, innerH, bw, 0, BAR_RADIUS)
            const totalY    = d.normExistingY + adY
            const totalYExX = totalY + d.normExistingX
            const h = y(totalYExX) - y(totalYExX + adX)
            return roundedTopRect(x(d.binId)!, y(totalYExX + adX), bw, Math.max(0, h), BAR_RADIUS)
          })
          .attr('opacity', (d) => (addMap.get(d.binId)?.normAddX ?? 0) > 0 ? 0.9 : 0)

        // overlay-Y — hide on bins that just left the selected range
        g.selectAll<SVGPathElement, Candle>('.bar-overlay-y')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('opacity', (d) => {
            if (d.binId < newStart || d.binId > newEnd) return 0
            return d.normOverlayY > 0 ? 0.75 : 0
          })

        // overlay-X — hide on bins that just left the selected range
        g.selectAll<SVGPathElement, Candle>('.bar-overlay-x')
          .transition().duration(DRAG_DUR).ease(DRAG_EASE)
          .attr('opacity', (d) => {
            if (d.binId < newStart || d.binId > newEnd) return 0
            return d.normOverlayX > 0 ? 0.75 : 0
          })
      }

      const dragLeft = d3.drag<SVGGElement, unknown>()
        .on('start', () => { draggingRef.current = { side: 'left', currentBin: startBin } })
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
        .on('start', () => { draggingRef.current = { side: 'right', currentBin: endBin } })
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

  }, [candles, activeBinId, binStep, startBin, endBin, editable, findNearestBin, onRangeChange, tokenXSymbol, tokenYSymbol, overlayColor, userBinIds, renderTick])

  // Tooltip cleanup on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove()
        tooltipRef.current = null
      }
    }
  }, [])

  const totalBins = endBin - startBin + 1

  return (
    <div className="rounded-lg border border-border bg-surface-overlay p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-xs text-text-muted">Liquidity Preview</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm opacity-20" style={{ backgroundColor: 'var(--color-reserve-x)' }} />
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--color-reserve-x)' }} />
            {tokenXSymbol}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-sm opacity-20" style={{ backgroundColor: 'var(--color-reserve-y)' }} />
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--color-reserve-y)' }} />
            {tokenYSymbol}
          </span>
          {overlayLabel ? (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: overlayColor }} />
              {overlayLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              pool · your deposit
            </span>
          )}
        </div>
      </div>
      <div className="relative cursor-ns-resize flex-1" style={{ minHeight: 250 }}>
        {/* SVG is always in the DOM so the ResizeObserver can attach before bin data arrives */}
        <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="xMidYMid meet" />
        {candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-text-muted">Loading…</span>
          </div>
        )}
        {extraPadding > 0 && candles.length > 0 && (
          <div className="absolute top-1 right-1 text-[10px] text-text-muted bg-surface-overlay/80 px-1.5 py-0.5 rounded">
            {candles.length} bins shown
          </div>
        )}
      </div>

      <div className={`flex items-center justify-between mt-2 shrink-0 ${editable ? '' : 'invisible'}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onRangeChange(startBin - 1, endBin)}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
          >-</button>
          <div className="text-xs font-mono text-text-secondary px-1">
            <span className="text-text-muted">Min </span>
            {formatBinPrice(startBin, binStep, 4)}
          </div>
          <button
            onClick={() => { if (startBin < endBin) onRangeChange(startBin + 1, endBin) }}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
          >+</button>
        </div>

        <span className="text-[10px] text-text-muted">{totalBins} bins</span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => { if (endBin > startBin) onRangeChange(startBin, endBin - 1) }}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
          >-</button>
          <div className="text-xs font-mono text-text-secondary px-1">
            <span className="text-text-muted">Max </span>
            {formatBinPrice(endBin, binStep, 4)}
          </div>
          <button
            onClick={() => onRangeChange(startBin, endBin + 1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-surface text-text-muted hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
          >+</button>
        </div>
      </div>
    </div>
  )
}
