/**
 * The live case-clock strip.
 *
 * Every screen spec in M-18 carries the same Z3 line: "GP-05 patient banner
 * PLUS the live case clock strip; the clock is visible on EVERY CASE SCREEN in
 * this module." So it is built once and passed into Z3 as `bannerExtra`.
 *
 * DD-012 governs the time: the clock is server-authoritative and the event
 * stream is append-only. A stamp records the server-derived case time, never
 * the browser's wall clock.
 */

import { useEffect, useMemo } from 'react'

import { Chip, Icon, cx } from '@/components/primitives'
import { CASE_INTERVALS, ACTIVE_CASE, STROKE_NOW, maybeStrokeCase } from '@/data/stroke'
import type { ClockInterval, IntervalState } from '@/data/stroke'
import { formatTime } from '@/data/format'
import { minutesBetween, useStroke } from '@/store/stroke'

/**
 * The current case time.
 *
 * It selects `elapsedSec` — a primitive — and derives the Date from it.
 * Selecting `caseNow()` directly would hand the store a fresh Date object on
 * every render, which never compares equal and re-renders forever.
 */
export function useCaseNow(): Date {
  const elapsedSec = useStroke((s) => s.elapsedSec)
  return useMemo(() => new Date(STROKE_NOW.getTime() + elapsedSec * 1000), [elapsedSec])
}

/** Runs the case clock for as long as a stroke screen is mounted. */
export function useCaseClock(): Date {
  const tick = useStroke((s) => s.tick)
  useEffect(() => {
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [tick])
  return useCaseNow()
}

/**
 * The live state of one interval, computed from the stamps rather than read
 * from the seed — so stamping the needle actually closes the DTN interval.
 */
export function liveInterval(interval: ClockInterval, caseNow: Date, stamped: (key: string) => Date | undefined) {
  const stampKey = interval.key === 'dtn' ? 'needle' : interval.key === 'dido' ? 'door-out' : interval.key
  const stamp = interval.stampedAt ?? stamped(stampKey)

  const elapsed = interval.startedAt
    ? minutesBetween(interval.startedAt, stamp ?? caseNow)
    : null

  let state = interval.state
  if (stamp) {
    state = 'DONE'
  } else if (interval.startedAt && interval.targetMin !== null && elapsed !== null && elapsed > interval.targetMin) {
    state = 'BREACH'
  } else if (interval.startedAt && !stamp) {
    state = interval.state === 'PENDING' ? 'PENDING' : 'RUNNING'
  }

  /**
   * "Projected to breach" and "has breached" are different claims, and the
   * atlas asks for the first one on the frame: AI-209 predicts the breach and
   * names the blocking step BEFORE the target is missed. So an interval that is
   * still inside its target but heading past it is `projected`, not `BREACH`.
   */
  const projected = interval.projectedBreachIn !== undefined && !stamp && state !== 'DONE'

  return { ...interval, elapsed, stamp, state, projected }
}

/** An interval that needs attention: already over target, or heading there. */
export function atRisk(i: { state: IntervalState; projected?: boolean }): boolean {
  return i.state === 'BREACH' || i.projected === true
}

export function useLiveIntervals() {
  const caseNow = useCaseNow()
  const stamps = useStroke((s) => s.stamps)
  const stamped = (key: string) => stamps.find((s) => s.key === key)?.at
  return CASE_INTERVALS.map((i) => liveInterval(i, caseNow, stamped))
}

/** The compact strip for Z3. The full rings live on S-18-06. */
export function CaseClockStrip({ caseId = ACTIVE_CASE.id }: { caseId?: string }) {
  const intervals = useLiveIntervals()
  const caseNow = useCaseNow()

  // Each case reads its own last-known-well. The interval stamps belong to the
  // index case's clock, so another case shows its LKW and nothing borrowed.
  const c = maybeStrokeCase(caseId) ?? ACTIVE_CASE
  const lkw = minutesBetween(c.lkw, caseNow)
  const headline =
    c.id === ACTIVE_CASE.id ? intervals.filter((i) => i.key === 'dtn' || i.key === 'dido' || i.key === 'd2ct') : []

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Chip tone="isolation" icon="Brain">
        STROKE/26-27/{caseId}
      </Chip>

      <span className="tabular flex items-center gap-1.5 text-[0.9em] font-semibold">
        <Icon name="Clock" size={14} className="text-ink-3" />
        LKW {formatTime(c.lkw)}
        <span className="font-normal text-ink-3">· {Math.floor(lkw / 60)}h {lkw % 60}m ago</span>
      </span>

      {headline.map((i) => (
        <span key={i.key} className="flex items-center gap-1.5">
          <span className="text-[0.82em] tracking-wide text-ink-3 uppercase">{shortLabel(i.key)}</span>
          <span
            className={cx(
              'tabular rounded-chip px-1.5 py-0.5 text-[0.88em] font-bold',
              i.state === 'BREACH'
                ? 'bg-abnormal-soft text-abnormal'
                : i.state === 'DONE'
                  ? 'bg-normal-soft text-normal'
                  : 'bg-caution-soft text-caution',
            )}
          >
            {i.elapsed === null ? '—' : i.elapsed}
            {i.targetMin !== null && <span className="font-normal opacity-70">/{i.targetMin}</span>}
          </span>
          {/* Clock state carried by a text label too, never colour alone. */}
          <span
            className={cx(
              'text-[0.74em] font-semibold tracking-wide uppercase',
              i.state === 'BREACH' ? 'text-abnormal' : i.state === 'DONE' ? 'text-normal' : 'text-caution',
            )}
          >
            {i.state}
          </span>
        </span>
      ))}

      <span className="tabular ml-auto flex items-center gap-1.5 text-[0.84em] text-ink-3">
        <Icon name="Radio" size={12} />
        server {formatTime(caseNow)}:{String(caseNow.getSeconds()).padStart(2, '0')} · append-only
      </span>
    </div>
  )
}

function shortLabel(key: string): string {
  switch (key) {
    case 'd2ct':
      return 'D2CT'
    case 'dtn':
      return 'DTN'
    case 'dido':
      return 'DIDO'
    default:
      return key.toUpperCase()
  }
}
