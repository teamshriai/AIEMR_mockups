/**
 * The NCCT viewer — the one imaging surface in the product.
 *
 * Real head-CT pixels, windowed to W 80 / L 40 at import time and served as
 * PNG slices (see `scripts/ncct-import.mjs`). No DICOM parser ships to the
 * browser; what a radiologist would call windowing has already happened, and
 * the window used is stated on the frame rather than implied.
 *
 * Three rules this screen inherits from the atlas and does not get to bend:
 *   • the UNMARKED image is always one control away (AIP-04) — an overlay that
 *     cannot be removed is a finding you cannot disagree with;
 *   • the model and its version are named on the frame, not in a tooltip;
 *   • the AI marks a region. It never writes on the image in words that read
 *     like a diagnosis.
 *
 * The imaging surface is black in both themes, because a CT read on a pale
 * surface is a CT read badly. Its chrome is therefore measured for contrast
 * against the image, not against the page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Icon, cx } from '@/components/primitives'
import { NCCT_WINDOW, slicePath } from '@/data/ncct.generated'
import type { NcctStudy } from '@/data/ncct.generated'

/** A region the model flagged, in normalised image coordinates (0–1). */
export interface NcctOverlay {
  cx: number
  cy: number
  rx: number
  ry: number
  label: string
  /** Which slices it appears on — 1-based, inclusive. */
  from: number
  to: number
  tone?: 'ai' | 'critical'
}

export function NcctViewer({
  study,
  overlays = [],
  /** Rendered under the image — the model line, the attest bar. */
  footer,
  initialSlice,
  className,
}: {
  study: NcctStudy
  overlays?: NcctOverlay[]
  footer?: ReactNode
  initialSlice?: number
  className?: string
}) {
  const mid = Math.max(1, Math.round(study.slices / 2))
  const [slice, setSlice] = useState(initialSlice ?? mid)
  const [showOverlay, setShowOverlay] = useState(true)
  const [zoom, setZoom] = useState(1)
  const frame = useRef<HTMLDivElement>(null)

  const step = useCallback(
    (delta: number) => setSlice((s) => Math.min(study.slices, Math.max(1, s + delta))),
    [study.slices],
  )

  /* Arrow keys scroll the stack, which is how every viewer in a reading room
     behaves. Only while the frame holds focus, so the page still scrolls. */
  useEffect(() => {
    const el = frame.current
    if (!el) return
    function onKey(e: KeyboardEvent) {
      if (!el?.contains(document.activeElement)) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const active = overlays.filter((o) => slice >= o.from && slice <= o.to)

  return (
    <div className={cx('min-w-0', className)}>
      <div
        ref={frame}
        tabIndex={0}
        role="group"
        aria-label={`Non-contrast CT head, slice ${slice} of ${study.slices}`}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) < 2) return
          step(e.deltaY > 0 ? 1 : -1)
        }}
        className="relative aspect-square w-full overflow-hidden rounded-card bg-black ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-ai"
      >
        <img
          src={slicePath(study.key, slice)}
          alt={`Axial non-contrast CT, slice ${slice} of ${study.slices}`}
          draggable={false}
          style={{ transform: `scale(${zoom})` }}
          className="absolute inset-0 size-full object-contain transition-transform duration-150"
        />

        {/* AIP-04 — the mark sits OVER the image and lifts off it completely. */}
        {showOverlay && active.length > 0 && (
          <svg
            data-ncct-overlay
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
          >
            {active.map((o) => (
              <ellipse
                key={o.label}
                cx={o.cx * 100}
                cy={o.cy * 100}
                rx={o.rx * 100}
                ry={o.ry * 100}
                fill="none"
                stroke={o.tone === 'critical' ? 'var(--color-on-image-critical)' : 'var(--color-on-image-ai)'}
                strokeWidth="2.5"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {/*
          The label is HTML rather than SVG text, and carries its own dark
          plate. An SVG <text> over the image inherits whatever is behind it —
          measured 1.76:1 where the mark sat over bright brain — and an outline
          does not fix that, because what a reader needs is a background.
        */}
        {showOverlay &&
          active.map((o) => (
            <span
              key={o.label}
              data-ncct-overlay
              style={{
                left: `${o.cx * 100}%`,
                top: `${(o.cy - o.ry) * 100}%`,
                color: o.tone === 'critical' ? 'var(--color-on-image-critical)' : 'var(--color-on-image-ai)',
              }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] rounded-chip bg-black/80 px-1.5 py-0.5 text-[0.66rem] font-bold tracking-wide whitespace-nowrap"
            >
              {o.label}
            </span>
          ))}

        {/* Corner metadata, the way a reading workstation lays it out. */}
        <p className="pointer-events-none absolute top-2 left-3 text-[0.7rem] leading-snug text-[color:var(--color-on-image-ink)]">
          NCCT head · axial
          <br />
          {study.seriesDescription}
        </p>
        <p className="tabular pointer-events-none absolute top-2 right-3 text-right text-[0.7rem] leading-snug text-[color:var(--color-on-image-ink)]">
          {study.sliceThickness} mm · {study.kvp} kV
          <br />W {NCCT_WINDOW.width} : L {NCCT_WINDOW.level}
        </p>
        <p className="tabular pointer-events-none absolute bottom-2 left-3 text-[0.7rem] text-[color:var(--color-on-image-ink)]">
          Im {slice} / {study.slices}
        </p>
        {showOverlay && active.length > 0 && (
          <p
            style={{ color: 'var(--color-on-image-ai)' }}
            className="pointer-events-none absolute right-3 bottom-2 text-[0.7rem] font-semibold"
          >
            AI overlay on
          </p>
        )}
      </div>

      {/* Controls. The overlay switch is first, because removing it is the right. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowOverlay((v) => !v)}
          aria-pressed={showOverlay}
          className={cx(
            'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-[0.86em] font-semibold transition-colors',
            showOverlay ? 'bg-ai-soft text-ai' : 'bg-glass-inset text-ink-3 hover:text-ink',
          )}
        >
          <Icon name={showOverlay ? 'Eye' : 'EyeOff'} size={14} />
          {showOverlay ? 'AI overlay on' : 'Show the overlay'}
        </button>

        <span className="inline-flex items-center gap-0.5 rounded-pill bg-glass-inset p-0.5">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={slice <= 1}
            aria-label="Previous slice"
            className="inline-flex size-9 items-center justify-center rounded-pill text-ink-2 hover:bg-glass-fill-hover disabled:opacity-40"
          >
            <Icon name="ChevronLeft" size={15} />
          </button>
          <input
            type="range"
            min={1}
            max={study.slices}
            value={slice}
            onChange={(e) => setSlice(Number(e.target.value))}
            aria-label="Slice"
            className="h-9 w-28 accent-[var(--color-brand)]"
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={slice >= study.slices}
            aria-label="Next slice"
            className="inline-flex size-9 items-center justify-center rounded-pill text-ink-2 hover:bg-glass-fill-hover disabled:opacity-40"
          >
            <Icon name="ChevronRight" size={15} />
          </button>
        </span>

        <span className="tabular text-[0.86em] text-ink-3">
          {slice} / {study.slices}
        </span>

        <button
          type="button"
          onClick={() => setZoom((z) => (z >= 2 ? 1 : Number((z + 0.5).toFixed(1))))}
          className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-glass-inset px-3 text-[0.86em] font-medium text-ink-2 hover:bg-glass-fill-hover"
        >
          <Icon name="Scan" size={14} />
          {zoom === 1 ? 'Zoom' : `${Math.round(zoom * 100)}%`}
        </button>
      </div>

      {footer}
    </div>
  )
}
