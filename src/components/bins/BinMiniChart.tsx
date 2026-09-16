'use client'

import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import type { BinData } from '@/hooks/useBinRange'
import { getPriceFromBinId, binReservesToValue } from '@/lib/binMath'

/**
 * Compact, axis-free bin liquidity overview — used as a visual summary thumbnail.
 */
export function BinMiniChart({
  bins,
  activeId,
  binStep,
}: {
  bins: BinData[]
  activeId: number
  binStep: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || bins.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const el = svgRef.current
    const width = el.clientWidth || 180
    const height = el.clientHeight || 100

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const styles = getComputedStyle(document.documentElement)
    const colorX = styles.getPropertyValue('--color-reserve-x').trim() || '#0DAB76'
    const colorY = styles.getPropertyValue('--color-reserve-y').trim() || '#139A43'
    const activeBinColor = styles.getPropertyValue('--color-active-bin').trim() || '#76fff4'

    const padTop = 4
    const padBottom = 2

    const x = d3
      .scaleBand<number>()
      .domain(bins.map((b) => b.binId))
      .range([0, width])
      .padding(0.1)

    const norm = (b: BinData) =>
      binReservesToValue(b.reserveX, b.reserveY, getPriceFromBinId(b.binId, binStep))

    const maxValue = d3.max(bins, (b) => norm(b).total) ?? 1
    const y = d3.scaleLinear().domain([0, maxValue]).range([height - padBottom, padTop])

    const g = svg.append('g')
    const bw = x.bandwidth()

    // Reserve X bars (top)
    g.selectAll('.mini-x')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => y(norm(d).total))
      .attr('width', bw)
      .attr('height', (d) => {
        const { valueX, total } = norm(d)
        return Math.max(0, y(total - valueX) - y(total))
      })
      .attr('fill', colorX)
      .attr('opacity', 0.85)

    // Reserve Y bars (bottom)
    g.selectAll('.mini-y')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => {
        const { valueX, total } = norm(d)
        return y(total - valueX)
      })
      .attr('width', bw)
      .attr('height', (d) => {
        const { valueY } = norm(d)
        return Math.max(0, height - padBottom - y(valueY))
      })
      .attr('fill', colorY)
      .attr('opacity', 0.85)

    // Active bin marker
    const ax = x(activeId)
    if (ax !== undefined) {
      g.append('line')
        .attr('x1', ax + bw / 2)
        .attr('x2', ax + bw / 2)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', activeBinColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('opacity', 0.8)
    }
  }, [bins, activeId, binStep])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    />
  )
}
