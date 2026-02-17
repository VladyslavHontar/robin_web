'use client'

import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import type { BinData } from '@/hooks/useBinRange'
import { formatBinPrice } from '@/lib/binMath'
import { formatWei } from '@/lib/formatters'

export function BinChart({
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

    const container = svgRef.current.parentElement
    const width = container?.clientWidth ?? 800
    const height = 320
    const margin = { top: 16, right: 16, bottom: 48, left: 60 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3
      .scaleBand<number>()
      .domain(bins.map((b) => b.binId))
      .range([0, innerW])
      .padding(0.15)

    const maxReserve = d3.max(bins, (b) => Number(b.reserveX + b.reserveY)) ?? 1

    const y = d3.scaleLinear().domain([0, maxReserve]).nice().range([innerH, 0])

    // X axis
    const tickValues = bins
      .filter((_, i) => i % Math.max(1, Math.floor(bins.length / 8)) === 0)
      .map((b) => b.binId)

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickValues)
          .tickFormat((d) => formatBinPrice(d as number, binStep, 4)),
      )
      .attr('color', '#55556a')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('transform', 'rotate(-35)')
      .attr('text-anchor', 'end')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2s')))
      .attr('color', '#55556a')
      .selectAll('text')
      .attr('font-size', '10px')

    // Bars — reserve Y (bottom, green)
    g.selectAll('.bar-y')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'bar-y')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => y(Number(d.reserveY)))
      .attr('width', x.bandwidth())
      .attr('height', (d) => innerH - y(Number(d.reserveY)))
      .attr('fill', (d) => (d.binId === activeId ? '#f59e0b' : '#22c55e'))
      .attr('opacity', 0.8)
      .attr('rx', 1)

    // Bars — reserve X (stacked on top, blue)
    g.selectAll('.bar-x')
      .data(bins)
      .enter()
      .append('rect')
      .attr('class', 'bar-x')
      .attr('x', (d) => x(d.binId)!)
      .attr('y', (d) => y(Number(d.reserveX + d.reserveY)))
      .attr('width', x.bandwidth())
      .attr('height', (d) => y(Number(d.reserveY)) - y(Number(d.reserveX + d.reserveY)))
      .attr('fill', (d) => (d.binId === activeId ? '#fbbf24' : '#3b82f6'))
      .attr('opacity', 0.8)
      .attr('rx', 1)

    // Active bin marker
    const activeBin = bins.find((b) => b.binId === activeId)
    if (activeBin && x(activeId) !== undefined) {
      g.append('line')
        .attr('x1', x(activeId)! + x.bandwidth() / 2)
        .attr('x2', x(activeId)! + x.bandwidth() / 2)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.5)
    }

    // Tooltip
    const tooltip = d3
      .select(svgRef.current.parentElement!)
      .append('div')
      .attr('class', 'absolute pointer-events-none bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs hidden')
      .style('z-index', '10')

    g.selectAll('.bar-y, .bar-x')
      .on('mouseover', function (event, d) {
        const bin = d as BinData
        tooltip
          .classed('hidden', false)
          .html(
            `<div class="font-mono">
              <div class="text-text-muted">Bin ${bin.binId}</div>
              <div>Price: ${formatBinPrice(bin.binId, binStep)}</div>
              <div class="text-reserve-x">X: ${formatWei(bin.reserveX)}</div>
              <div class="text-reserve-y">Y: ${formatWei(bin.reserveY)}</div>
              ${bin.binId === activeId ? '<div class="text-active-bin mt-1">Active Bin</div>' : ''}
            </div>`,
          )
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

    return () => {
      tooltip.remove()
    }
  }, [bins, activeId, binStep])

  if (bins.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-8 text-center text-text-muted">
        No bin data available
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">Bin Liquidity Distribution</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-reserve-x" /> Token X
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-reserve-y" /> Token Y
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-active-bin" /> Active
          </span>
        </div>
      </div>
      <div className="relative">
        <svg ref={svgRef} className="w-full" preserveAspectRatio="xMidYMid meet" />
      </div>
    </div>
  )
}
