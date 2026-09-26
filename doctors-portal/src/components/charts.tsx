/**
 * Charts, in plain SVG.
 *
 * Built to the visualization method: form chosen for the data's job, colour
 * assigned by role and validated (worst adjacent CVD ΔE 24.7 light / 26.8 dark),
 * 2px lines, markers >= 8px, a 2px surface ring on the emphasised point, a
 * recessive grid, a crosshair-and-tooltip hover layer by default, and a table
 * view — which the light-mode slot-2 contrast warning makes obligatory, not
 * optional.
 *
 * Two rules from the clinical side sit on top of it:
 *   §5.3 — a status is never colour alone, so an out-of-range point carries an
 *   icon and the word as well as the hue.
 *   No dual-axis chart, ever. Two measures of different scale are two charts.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Button, Chip, Icon, Table, Td, Th, Tr, cx } from './primitives'

export interface TrendPoint {
  at: Date
  value: number
  /** Set where this point is out of range — drives the status marker. */
  flag?: 'high' | 'low' | 'critical'
}

/**
 * Change over time for ONE measure. A single series needs no legend — the title
 * names it. The reference range is a band, not a series, because it is context
 * rather than data.
 */
export function TrendChart({
  title,
  unit,
  points,
  refLow,
  refHigh,
  height = 200,
  label,
}: {
  title: string
  unit: string
  points: TrendPoint[]
  refLow?: number
  refHigh?: number
  height?: number
  /** How to label the x axis ticks. */
  label: (d: Date) => string
}) {
  const clipId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  /*
   * The drawing is as wide as the space it has, in real pixels, so its text is
   * always 11–12px. A fixed 640-wide viewBox scaled to fit shrank the axis
   * labels to 7px in a narrow card.
   */
  const figureRef = useRef<HTMLElement>(null)
  const [measured, setMeasured] = useState(0)
  useEffect(() => {
    const el = figureRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setMeasured(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = { top: 16, right: 56, bottom: 28, left: 44 }
  const w = measured > 0 ? measured : 640
  const h = height

  const values = points.map((p) => p.value)
  const lo = Math.min(...values, refLow ?? Infinity)
  const hi = Math.max(...values, refHigh ?? -Infinity)
  const span = hi - lo || 1
  // A measure that cannot go below zero never draws an axis that does.
  const yMin = lo >= 0 ? Math.max(0, lo - span * 0.18) : lo - span * 0.18
  const yMax = hi + span * 0.18

  const x = (i: number) => pad.left + (i / Math.max(1, points.length - 1)) * (w - pad.left - pad.right)
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * (h - pad.top - pad.bottom)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  const active = hover ?? last

  /** Four ticks, at the value scale rather than at arbitrary pixels. */
  const ticks = [0, 1, 2, 3].map((k) => yMin + ((yMax - yMin) * k) / 3)

  return (
    <figure ref={figureRef} className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="text-[0.86em] text-ink-3">
            {unit} · {points.length} results
            {refLow !== undefined && refHigh !== undefined && ` · reference ${refLow}–${refHigh}`}
          </p>
        </div>
        <Button size="sm" icon={showTable ? 'ChartLine' : 'Table'} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Show the chart' : 'Show the values'}
        </Button>
      </figcaption>

      {showTable ? (
        <Table
          caption={`${title} values`}
          rowCount={`${points.length} results`}
          head={
            <>
              <Th>When</Th>
              <Th>Value</Th>
              <Th>Range</Th>
            </>
          }
        >
          {[...points].reverse().map((p) => (
            <Tr key={p.at.toISOString()}>
              <Td className="tabular">{label(p.at)}</Td>
              <Td className="tabular font-medium">
                {p.value} {unit}
              </Td>
              <Td>{p.flag ? <StatusChip flag={p.flag} /> : <Chip tone="normal" icon="Check">In range</Chip>}</Td>
            </Tr>
          ))}
        </Table>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            width={w}
            height={h}
            className="block w-full"
            role="img"
            aria-label={`${title} over time, ${points.length} results, latest ${points[last].value} ${unit}`}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={pad.left} y={pad.top} width={w - pad.left - pad.right} height={h - pad.top - pad.bottom} />
              </clipPath>
            </defs>

            {/* The reference range, as context rather than a series. */}
            {refLow !== undefined && refHigh !== undefined && (
              <rect
                x={pad.left}
                y={y(refHigh)}
                width={w - pad.left - pad.right}
                height={Math.max(2, y(refLow) - y(refHigh))}
                fill="var(--color-viz-band)"
                clipPath={`url(#${clipId})`}
              />
            )}

            {/* Recessive grid. */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--color-viz-grid)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-[var(--color-ink-3)] text-[11px] tabular-nums"
                >
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {/* Crosshair on the hovered point. */}
            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={pad.top}
                y2={h - pad.bottom}
                stroke="var(--color-ink-3)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* The series. 2px, no fill — a fill would imply an area measure. */}
            <path d={path} fill="none" stroke="var(--color-viz-1)" strokeWidth={2} strokeLinecap="round" />

            {points.map((p, i) => (
              <g key={p.at.toISOString()}>
                {/* A hit target larger than the mark. */}
                <rect
                  x={x(i) - 18}
                  y={pad.top}
                  width={36}
                  height={h - pad.top - pad.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={i === active ? 6 : 4.5}
                  fill={
                    p.flag === 'critical'
                      ? 'var(--color-critical)'
                      : p.flag
                        ? 'var(--color-abnormal)'
                        : 'var(--color-viz-1)'
                  }
                  /* A 2px surface ring so overlapping marks stay separable. */
                  stroke="var(--color-glass-fill-strong)"
                  strokeWidth={2}
                />
              </g>
            ))}

            {/* A direct label on the latest point only — never one per point. */}
            <text
              x={x(last) + 10}
              y={y(points[last].value)}
              dominantBaseline="middle"
              className="fill-[var(--color-ink)] text-[12px] font-semibold tabular-nums"
            >
              {points[last].value}
            </text>

            {/* x ticks: first and last, so the axis does not crowd. */}
            <text x={pad.left} y={h - 8} className="fill-[var(--color-ink-3)] text-[11px]">
              {label(points[0].at)}
            </text>
            <text x={w - pad.right} y={h - 8} textAnchor="end" className="fill-[var(--color-ink-3)] text-[11px]">
              {label(points[last].at)}
            </text>
          </svg>

          {/* Tooltip. */}
          <div
            className={cx(
              'glass-strong pointer-events-none absolute top-2 rounded-panel px-3 py-2 shadow-glass',
              hover === null && 'opacity-0',
            )}
            style={{ left: `${(x(active) / w) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <p className="tabular text-[0.86em] text-ink-3">{label(points[active].at)}</p>
            <p className="tabular font-semibold">
              {points[active].value} {unit}
            </p>
            {points[active].flag && <StatusChip flag={points[active].flag!} className="mt-1" />}
          </div>
        </div>
      )}
    </figure>
  )
}

/** §5.3 — a status carries an icon and the word, never the colour alone. */
function StatusChip({ flag, className }: { flag: 'high' | 'low' | 'critical'; className?: string }) {
  if (flag === 'critical') {
    return (
      <Chip tone="critical" icon="TriangleAlert" className={className}>
        Critical
      </Chip>
    )
  }
  return (
    <Chip tone="abnormal" icon={flag === 'high' ? 'ArrowUp' : 'ArrowDown'} className={className}>
      {flag === 'high' ? 'High' : 'Low'}
    </Chip>
  )
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 100) return String(Math.round(v))
  if (Math.abs(v) >= 10) return v.toFixed(0)
  return v.toFixed(1)
}

export interface DonutSlice {
  key: string
  label: string
  value: number
  /** A CSS colour — a token, never a raw hex. */
  color: string
}

/**
 * Parts of one small whole — how a patient's results fall — as a ring.
 *
 * Kept small and quiet: a fixed size, soft slice strength, a hairline gap
 * between slices, and the total in the middle. The legend beside it is HTML
 * and carries the word and the count for every slice, so the ring is never
 * the only place a number lives (§5.3).
 */
export function Donut({
  slices,
  label,
  size = 112,
  thickness = 14,
  center,
}: {
  slices: DonutSlice[]
  /** The accessible name — what the ring shows, in words. */
  label: string
  size?: number
  thickness?: number
  /** In the hole — usually the total. */
  center?: ReactNode
}) {
  const shown = slices.filter((s) => s.value > 0)
  const total = shown.reduce((n, s) => n + s.value, 0)
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const gap = shown.length > 1 ? 2 : 0
  const arcs = shown.map((s, i) => {
    const start = shown.slice(0, i).reduce((n, x) => n + (x.value / total) * circumference, 0)
    return { ...s, start, length: (s.value / total) * circumference }
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-glass-inset)" strokeWidth={thickness} />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, a.length - gap)} ${circumference}`}
              strokeDashoffset={-a.start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
      </svg>
      {center !== undefined && (
        <span aria-hidden className="absolute inset-0 grid place-items-center text-center">
          {center}
        </span>
      )}
    </div>
  )
}

/**
 * A sparkline — the shape of a trend, at a glance, inside a panel.
 *
 * A sparkline has no axes, so the latest value is DIRECTLY LABELLED beside it.
 * Without that label the mark says "rising" but not "rising to what", and in a
 * clinical panel that is the part that matters. The whole series is still in
 * the accessible name, so nothing is available only as a picture.
 */
export function Sparkline({
  points,
  unit,
  label,
}: {
  points: TrendPoint[]
  unit: string
  /** What the series is, for the accessible name. */
  label: string
}) {
  if (points.length < 2) return null

  const w = 96
  const h = 26
  const values = points.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => (i / (points.length - 1)) * (w - 2) + 1
  const y = (v: number) => h - 3 - ((v - lo) / span) * (h - 6)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const rising = last.value > points[0].value

  return (
    <span className="flex shrink-0 items-center gap-2">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${label}: ${values.map((v) => formatTick(v)).join(', ')} ${unit}`}
        className="overflow-visible"
      >
        <path d={path} fill="none" stroke="var(--color-viz-1)" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="2.6" fill="var(--color-viz-1)" />
      </svg>
      <span className="tabular flex items-center gap-1 text-[0.86em] font-semibold whitespace-nowrap">
        {formatTick(last.value)}
        <span className="font-normal text-ink-3">{unit}</span>
        <Icon name={rising ? 'ArrowUp' : 'ArrowDown'} size={11} className="text-ink-3" />
      </span>
    </span>
  )
}

/**
 * Two parts of a whole, side by side — for the perfusion core/penumbra split.
 * Both segments are directly labelled, which is what the light-mode contrast
 * warning on slot 2 obliges.
 */
export function SplitBar({
  parts,
  unit,
  caption,
}: {
  parts: { label: string; value: number; slot: 1 | 2 }[]
  unit: string
  caption?: string
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <figure className="m-0">
      <div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-pill">
        {parts.map((p) => (
          <div
            key={p.label}
            style={{
              width: `${(p.value / total) * 100}%`,
              backgroundColor: p.slot === 1 ? 'var(--color-viz-1)' : 'var(--color-viz-2)',
            }}
            className="flex items-center justify-center"
          >
            <span className="tabular px-2 text-[0.8em] font-bold text-white">
              {(p.value / total) * 100 >= 12 ? `${p.value}` : ''}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-[0.88em]">
            <span
              aria-hidden
              className="block size-2.5 rounded-[2px]"
              style={{ backgroundColor: p.slot === 1 ? 'var(--color-viz-1)' : 'var(--color-viz-2)' }}
            />
            <span className="text-ink-2">{p.label}</span>
            <span className="tabular font-semibold">
              {p.value} {unit}
            </span>
          </span>
        ))}
        {caption && <span className="text-[0.86em] text-ink-3">{caption}</span>}
      </figcaption>
    </figure>
  )
}

/**
 * Indicator bars against a target. One series, so no legend; the target is a
 * marker rather than a second series, and met/missed carries an icon and a word.
 */
export function IndicatorBars({
  rows,
}: {
  rows: { label: string; value: string; target: string; met: boolean; fraction: number }[]
}) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{r.label}</span>
            <span className="flex items-center gap-2">
              <span className="tabular font-semibold">{r.value}</span>
              <Chip tone={r.met ? 'normal' : 'abnormal'} icon={r.met ? 'Check' : 'TriangleAlert'}>
                {r.met ? 'Met' : 'Missed'}
              </Chip>
            </span>
          </div>
          <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-pill bg-glass-fill-muted">
            <div
              className="h-full rounded-pill"
              style={{
                width: `${Math.min(100, r.fraction * 100)}%`,
                backgroundColor: r.met ? 'var(--color-viz-1)' : 'var(--color-abnormal)',
              }}
            />
            {/* The target, as a marker on the same axis — never a second scale. */}
            <span
              aria-hidden
              className="absolute inset-y-0 w-0.5 bg-ink-3"
              style={{ left: '100%', transform: 'translateX(-2px)' }}
            />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[0.84em] text-ink-3">
            <Icon name="Target" size={11} />
            target {r.target}
          </p>
        </li>
      ))}
    </ul>
  )
}
