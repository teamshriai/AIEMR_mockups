/**
 * The doctor's month.
 *
 * A compact month grid — Monday first — that says two things at a glance:
 * which day is today (a soft filled circle with a faint halo) and how full
 * each day is (one dot light, two moderate, three busy, the last one red where
 * the day carries something critical). No text inside the cells; the load is
 * in each cell's name for a screen reader. The month is the header, with two
 * small arrows and, when you have wandered off it, a quiet way back. A new
 * month slides in from the side you moved towards.
 *
 * A date pops its day out beside it (`DayPeek`) — its AI brief, its sessions
 * and who is booked — on hover after a short pause, or pinned open by a click,
 * a tap or Enter. It floats over the page, so the calendar never changes size
 * and the Today card stays the live day.
 *
 * On My Day it sits under Patients Today, a touch lighter than the cards
 * around it, and with `fill` it takes the rest of its column, its weeks sharing
 * the height, so the two columns end level.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { Panel } from '@/components/myday'
import { Icon, IconButton, cx } from '@/components/primitives'
import { LOAD_WORD, dayBrief, dayCounts, dayLoad, monthDays, sameDay } from '@/data/calendar'
import type { CalendarEntry, DayLoad } from '@/data/calendar'
import { NOW, formatDateLong, formatTime } from '@/data/format'
import { selectAiActive, useAI } from '@/store/ai'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Hover must rest this long before a day pops out, so sweeping across the grid does not flicker. */
const OPEN_AFTER_MS = 280
/** And a moment's grace when the pointer leaves, so it can travel from the date into the card. */
const CLOSE_AFTER_MS = 160

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function sessionWord(day: Date, n: number): string {
  return sameDay(day, NOW) ? plural(n, 'activity', 'activities') : plural(n, 'session', 'sessions')
}

/** How a date reads to a screen reader, and in its tooltip — the dots in words. */
function describe(day: Date, entries: CalendarEntry[]): string {
  const sessions = entries.filter((e) => e.kind === 'session').length
  const booked = entries.filter((e) => e.kind === 'appointment').length
  // Today is the day plan — activities, not only clinic sessions.
  const what = [sessions > 0 && sessionWord(day, sessions), booked > 0 && plural(booked, 'appointment', 'appointments')]
    .filter(Boolean)
    .join(', ')
  const load = dayLoad(entries)
  const critical = entries.some((e) => e.critical)
  return `${formatDateLong(day)}${sameDay(day, NOW) ? ', today' : ''}: ${what || 'nothing booked'}${
    load > 0 ? ` — ${LOAD_WORD[load]}` : ''
  }${critical ? ', critical activity' : ''}`
}

/** A day's load as dots: muted blue, the last one red where the day carries something critical. */
function LoadDots({ entries }: { entries: CalendarEntry[] }) {
  const load = dayLoad(entries)
  const critical = entries.some((e) => e.critical)
  return (
    <span aria-hidden className="flex h-1.5 items-center gap-[3px]">
      {Array.from({ length: load }, (_, i) => (
        <span
          key={i}
          className={cx('size-1.5 rounded-pill', critical && i === load - 1 ? 'bg-pri-critical' : 'bg-pri-normal')}
        />
      ))}
    </span>
  )
}

const dayKey = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

interface Peek {
  day: Date
  /** The date's cell, which the card points at. */
  anchor: DOMRect
  /** Opened by a click, a tap or Enter: it stays until closed. Hover-opened ones follow the pointer. */
  pinned: boolean
}

export function MonthCalendarCard({
  entriesFor,
  fill,
  className,
}: {
  /** Everything on a date. */
  entriesFor: (day: Date) => CalendarEntry[]
  /** Take the rest of the column; the weeks share the extra height evenly. */
  fill?: boolean
  className?: string
}) {
  const [view, setView] = useState({ year: NOW.getFullYear(), month: NOW.getMonth() })
  /** Which way the last month change went, so the new month slides in from that side. */
  const [dir, setDir] = useState<-1 | 0 | 1>(0)
  const days = monthDays(view.year, view.month)

  const [peek, setPeek] = useState<Peek | null>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())

  const clearTimers = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }
  const close = (refocus?: boolean) => {
    clearTimers()
    setPeek((p) => {
      if (refocus && p) cellRefs.current.get(dayKey(p.day))?.focus()
      return null
    })
  }
  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setPeek((p) => (p && !p.pinned ? null : p)), CLOSE_AFTER_MS)
  }
  useEffect(() => clearTimers, [])

  const goTo = (year: number, month: number) => {
    const d = new Date(year, month, 1)
    setDir(d.getTime() > new Date(view.year, view.month, 1).getTime() ? 1 : -1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
    close()
  }
  const step = (by: number) => goTo(view.year, view.month + by)
  const onThisMonth = view.year === NOW.getFullYear() && view.month === NOW.getMonth()

  return (
    <Panel
      className={cx(
        // A touch lighter than the cards around it, and the faintest lift.
        'border-card-schedule-line bg-calendar-surface shadow-glass-lg',
        // Pinned, the calendar rises above the dimmed page with its card, so the date stays sharp.
        peek?.pinned && 'relative z-[80]',
        fill && 'flex flex-col',
        className,
      )}
    >
      <section aria-label="Calendar" className={cx('min-w-0', fill && 'flex flex-1 flex-col')}>
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="tabular text-[1.05em] font-semibold tracking-tight text-ink" aria-live="polite">
            {MONTH_NAMES[view.month]} {view.year}
          </h2>
          <span className="flex items-center gap-0.5">
            {!onThisMonth && (
              <button
                type="button"
                onClick={() => goTo(NOW.getFullYear(), NOW.getMonth())}
                className="mr-1 min-h-8 rounded-chip px-2.5 text-[0.82em] font-medium text-ink-3 transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover hover:text-brand"
              >
                Today
              </button>
            )}
            <IconButton icon="ChevronLeft" label="Previous month" onClick={() => step(-1)} className="size-8 text-ink-3" size={15} />
            <IconButton icon="ChevronRight" label="Next month" onClick={() => step(1)} className="size-8 text-ink-3" size={15} />
          </span>
        </header>

        <div className={cx('px-4 pb-4', fill && 'flex flex-1 flex-col')}>
          {/* Keyed by month, so a change of month plays its short slide-in. */}
          <div
            key={`${view.year}-${view.month}`}
            className={cx(
              'grid grid-cols-7 gap-1',
              fill && 'flex-1',
              dir === 1 && 'cal-in-next',
              dir === -1 && 'cal-in-prev',
            )}
            style={fill ? { gridTemplateRows: `auto repeat(${days.length / 7}, minmax(2.75rem, 1fr))` } : undefined}
          >
            {WEEKDAY_HEAD.map((d) => (
              <span key={d} aria-hidden className="pb-1 text-center text-[0.72em] font-medium tracking-wide text-ink-3 uppercase">
                {d}
              </span>
            ))}
            {days.map((day) => {
              const entries = entriesFor(day)
              const key = dayKey(day)
              const inMonth = day.getMonth() === view.month
              const today = sameDay(day, NOW)
              const open = peek !== null && sameDay(peek.day, day)
              return (
                <button
                  key={key}
                  ref={(el) => {
                    if (el) cellRefs.current.set(key, el)
                    else cellRefs.current.delete(key)
                  }}
                  type="button"
                  data-calendar-day={key}
                  aria-label={describe(day, entries)}
                  aria-current={today ? 'date' : undefined}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onMouseEnter={(e) => {
                    window.clearTimeout(closeTimer.current)
                    if (peek?.pinned) return
                    const anchor = e.currentTarget.getBoundingClientRect()
                    window.clearTimeout(openTimer.current)
                    openTimer.current = window.setTimeout(() => setPeek({ day, anchor, pinned: false }), OPEN_AFTER_MS)
                  }}
                  onMouseLeave={() => {
                    window.clearTimeout(openTimer.current)
                    scheduleClose()
                  }}
                  onClick={(e) => {
                    clearTimers()
                    const anchor = e.currentTarget.getBoundingClientRect()
                    setPeek((p) => (p && p.pinned && sameDay(p.day, day) ? null : { day, anchor, pinned: true }))
                  }}
                  className={cx(
                    'flex min-h-11 flex-col items-center justify-center gap-1 rounded-panel',
                    'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
                    open && 'bg-brand-soft ring-2 ring-brand/45',
                  )}
                >
                  <span
                    className={cx(
                      'tabular grid size-7 place-items-center rounded-pill text-[0.88em] transition-colors duration-150',
                      today
                        ? 'bg-brand font-semibold text-brand-on ring-4 ring-brand/15'
                        : open
                          ? 'font-semibold text-brand'
                          : inMonth
                            ? 'text-ink'
                            : 'text-ink-muted',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <LoadDots entries={entries} />
                </button>
              )
            })}
          </div>

          {/* The dots, in words — once, under the grid, never inside it. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 px-1 text-[0.78em] text-ink-3">
            {(
              [
                [1, 'Light'],
                [2, 'Moderate'],
                [3, 'Busy'],
              ] as const
            ).map(([n, word]) => (
              <span key={word} className="flex items-center gap-1.5">
                <span aria-hidden className="flex items-center gap-[3px]">
                  {Array.from({ length: n }, (_, i) => (
                    <span key={i} className="size-1.5 rounded-pill bg-pri-normal" />
                  ))}
                </span>
                {word}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-pill bg-pri-critical" />
              Critical
            </span>
          </p>
        </div>
      </section>

      {peek && (
        <DayPeek
          peek={peek}
          entries={entriesFor(peek.day)}
          onEnter={() => window.clearTimeout(closeTimer.current)}
          onLeave={scheduleClose}
          onClose={close}
          isCell={(el) => [...cellRefs.current.values()].some((c) => c.contains(el))}
        />
      )}
    </Panel>
  )
}

/**
 * One date, popped out from its cell — a picture of the day, not a list.
 *
 *   the head   the date large, the weekday and month, how full the day is as a
 *              three-bar meter, and what it holds as icon chips, on a soft wash
 *   the strip  the day drawn across its hours: sessions as bars, the patients
 *              booked as pins, and a red line where it is now
 *   the brief  AI-608's reading of the day, when the AI is on
 *   the rest   the sessions as tiles in their function's hue, and the patients
 *              booked with their initials — each a link to where it lives
 *
 * Deliberately not the Today card: a light, lifted card with a glow, not the
 * slate rail. It points at its date, sits below it or — where there is no room
 * — above, and never leaves the viewport. Pinned (click, tap, Enter), the page
 * behind dims a little and the card takes focus; Esc, a click outside or a
 * scroll closes it, and focus returns to the date.
 */
function DayPeek({
  peek,
  entries,
  onEnter,
  onLeave,
  onClose,
  isCell,
}: {
  peek: Peek
  entries: CalendarEntry[]
  onEnter: () => void
  onLeave: () => void
  onClose: (refocus?: boolean) => void
  isCell: (el: Node) => boolean
}) {
  const aiActive = useAI(selectAiActive)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean; arrow: number } | null>(null)

  const { day, anchor, pinned } = peek
  const today = sameDay(day, NOW)
  const past = !today && day < NOW
  const sessions = entries.filter((e) => e.kind === 'session').sort((a, b) => a.at.getTime() - b.at.getTime())
  const booked = entries.filter((e) => e.kind === 'appointment').sort((a, b) => a.at.getTime() - b.at.getTime())
  const load = dayLoad(entries)
  const critical = entries.some((e) => e.critical)
  const label = `${formatDateLong(day)}${today ? ' · today' : ''}`

  // Measure, then place: below the date when it fits, else above; clamped to the viewport.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const gap = 12
    const margin = 8
    const above = window.innerHeight - anchor.bottom < h + gap + margin && anchor.top > h + gap + margin
    const top = above ? anchor.top - h - gap : Math.min(anchor.bottom + gap, window.innerHeight - h - margin)
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - w / 2, margin), window.innerWidth - w - margin)
    // The arrow points at the date's centre, kept clear of the card's rounded corners.
    const arrow = Math.min(Math.max(anchor.left + anchor.width / 2 - left - 7, 20), w - 34)
    setPos({ top: Math.max(top, margin), left, above, arrow })
  }, [anchor])

  // Focus moves in once the card is placed and visible — a hidden element cannot take it.
  // preventScroll: a scroll closes the card, so taking focus must not cause one.
  const placed = pos !== null
  useEffect(() => {
    if (pinned && placed) ref.current?.querySelector<HTMLElement>('button, a')?.focus({ preventScroll: true })
  }, [pinned, placed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose(true)
      }
    }
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !isCell(t)) onClose()
    }
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose, isCell])

  return createPortal(
    <>
      {/* Pinned, the page behind steps back a little — a hover never dims it. */}
      {pinned && <div aria-hidden className="fade-in fixed inset-0 z-[79] bg-[rgb(10_14_26/0.18)] backdrop-blur-[1px]" />}

      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-label={`${label} — ${dayCounts(day, entries)}`}
        onMouseEnter={onEnter}
        onMouseLeave={() => {
          if (!pinned) onLeave()
        }}
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
        className={cx(
          'peek-card fixed z-80 w-[min(30rem,calc(100vw-1rem))]',
          pos && (pos.above ? 'peek-in-above' : 'peek-in-below'),
        )}
      >
        {/* The pointer back to the date, in the colour of the edge it leaves from. */}
        {pos && (
          <span
            aria-hidden
            style={{ left: pos.arrow }}
            className={cx(
              'absolute size-3.5 rotate-45 border-[var(--color-menu-border)]',
              pos.above ? '-bottom-[7px] border-r border-b bg-[var(--color-menu)]' : '-top-[7px] border-t border-l bg-peek-from',
            )}
          />
        )}

        {/* THE HEAD — the date large, the meter, the chips. */}
        <header className="peek-head relative overflow-hidden rounded-t-[15px] px-5 pt-4 pb-4">
          {/* A faint calendar glyph, for the picture — never read. */}
          <Icon name="CalendarCheck" size={96} className="pointer-events-none absolute -right-4 -bottom-6 text-brand opacity-[0.07]" />
          <div className="relative flex items-start gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-[var(--color-menu)] shadow-glass">
              <span className="text-center leading-none">
                <span className="block text-[0.66em] font-semibold tracking-[0.12em] text-pri-critical-ink uppercase">
                  {WEEKDAY_HEAD[(day.getDay() + 6) % 7]}
                </span>
                <span className="tabular mt-1 block text-[1.75em] font-bold tracking-tight text-ink">{day.getDate()}</span>
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[1.08em] font-semibold tracking-tight text-ink">
                {MONTH_NAMES[day.getMonth()]} {day.getFullYear()}
              </h3>
              <p className="mt-0.5 text-[0.86em] text-ink-2">
                {today ? 'Today' : past ? 'Earlier this month' : 'Coming up'}
                <span className="text-ink-3"> · {WEEKDAY_LONG[day.getDay()]}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <PeekChip icon="CalendarCheck">{sessions.length} {sessions.length === 1 ? (today ? 'activity' : 'session') : today ? 'activities' : 'sessions'}</PeekChip>
                <PeekChip icon="Users">{booked.length} booked</PeekChip>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {pinned && (
                <IconButton icon="X" label="Close" onClick={() => onClose(true)} compact size={14} className="-mt-1.5 -mr-2" />
              )}
              <LoadMeter load={load} critical={critical} />
            </div>
          </div>
        </header>

        <div className="thin-scroll max-h-[min(30rem,62vh)] space-y-4 overflow-y-auto px-5 pt-4 pb-5">
          {/* THE STRIP — the day drawn across its hours. */}
          {entries.length > 0 && <DayStrip day={day} sessions={sessions} booked={booked} />}

          {aiActive && entries.length > 0 && <DayBrief day={day} entries={entries} />}

          {entries.length === 0 ? (
            <div className="grid place-items-center gap-2 py-6 text-center">
              <span className="grid size-12 place-items-center rounded-pill bg-glass-inset text-ink-3">
                <Icon name="Sunrise" size={22} />
              </span>
              <p className="text-[0.92em] text-ink-2">A clear day — nothing is booked.</p>
            </div>
          ) : (
            <>
              {sessions.length > 0 && (
                <section>
                  <PeekHeading icon="CalendarCheck">Sessions</PeekHeading>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {sessions.map((e) => (
                      <li key={e.id}>
                        <SessionTile entry={e} onPick={() => onClose()} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {booked.length > 0 && (
                <section>
                  <PeekHeading icon="Users">Booked with you</PeekHeading>
                  <ul className="space-y-1">
                    {booked.map((e) => (
                      <li key={e.id}>
                        <BookedRow entry={e} onPick={() => onClose()} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function PeekChip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-pill bg-[var(--color-menu)]/80 px-2.5 text-[0.82em] font-medium text-ink-2 shadow-glass">
      <Icon name={icon} size={13} className="text-brand" />
      {children}
    </span>
  )
}

function PeekHeading({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <h4 className="mb-1.5 flex items-center gap-1.5 text-[0.74em] font-semibold tracking-[0.08em] text-ink-3 uppercase">
      <Icon name={icon} size={12} />
      {children}
    </h4>
  )
}

/** How full the day is, as three rising bars — the calendar's dots, drawn larger, with the word. */
function LoadMeter({ load, critical }: { load: DayLoad; critical: boolean }) {
  return (
    <span className="flex flex-col items-end gap-1" title={LOAD_WORD[load]}>
      <span aria-hidden className="flex h-5 items-end gap-[3px]">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{ height: `${n * 6 + 2}px` }}
            className={cx(
              'w-1.5 rounded-pill',
              n > load ? 'bg-glass-hairline' : critical && n === load ? 'bg-pri-critical' : 'bg-pri-normal',
            )}
          />
        ))}
      </span>
      <span className="text-[0.72em] font-medium text-ink-3 capitalize">{load === 0 ? 'Clear' : LOAD_WORD[load].replace(' day', '')}</span>
    </span>
  )
}

/**
 * The day across its hours — 07:00 to 19:00, or wider if the day is. Sessions
 * are bars from their start to their end (a short bar where there is no end),
 * the patients booked are pins below them, and today carries a red Now line.
 */
function DayStrip({ day, sessions, booked }: { day: Date; sessions: CalendarEntry[]; booked: CalendarEntry[] }) {
  const all = [...sessions, ...booked]
  const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60
  const start = Math.min(7, ...all.map((e) => Math.floor(hourOf(e.at))))
  const end = Math.max(19, ...all.map((e) => Math.ceil(hourOf(e.until ?? e.at) + 0.5)))
  const span = end - start
  const x = (h: number) => `${((h - start) / span) * 100}%`
  const ticks = Array.from({ length: Math.floor(span / 3) + 1 }, (_, i) => start + i * 3).filter((h) => h <= end)
  const now = sameDay(day, NOW) ? hourOf(NOW) : undefined

  return (
    <figure aria-label="The day across its hours" className="rounded-[12px] bg-glass-inset px-3 pt-3 pb-2">
      <div className="relative h-[52px]">
        {/* Hour grid. */}
        {ticks.map((h) => (
          <span key={h} aria-hidden className="absolute top-0 bottom-3 w-px bg-glass-hairline" style={{ left: x(h) }} />
        ))}
        {/* Sessions, as bars. */}
        {sessions.map((e) => {
          const s = hourOf(e.at)
          const f = e.until ? hourOf(e.until) : s + 0.6
          return (
            <span
              key={e.id}
              title={`${formatTime(e.at)}${e.until ? `–${formatTime(e.until)}` : ''} · ${e.title}`}
              style={{ left: x(s), width: `max(10px, calc(${((f - s) / span) * 100}% - 2px))` }}
              className={cx('absolute top-1 h-4 rounded-[5px] ring-1 ring-[var(--color-menu)]', TILE[toneFor(e.icon)].bar)}
            />
          )
        })}
        {/* The patients booked, as pins. */}
        {booked.map((e) => (
          <span
            key={e.id}
            title={`${formatTime(e.at)} · ${e.title}`}
            style={{ left: `calc(${x(hourOf(e.at))} - 5px)` }}
            className={cx(
              'absolute top-7 size-2.5 rounded-pill ring-2 ring-[var(--color-menu)]',
              e.done ? 'bg-ink-muted' : 'bg-pri-normal',
            )}
          />
        ))}
        {now !== undefined && now >= start && now <= end && (
          <span aria-hidden className="absolute -top-1 bottom-2 w-0.5 rounded-pill bg-pri-critical" style={{ left: x(now) }}>
            <span className="absolute -top-1 -left-[3px] size-2 rounded-pill bg-pri-critical" />
          </span>
        )}
        {/* Hour labels. */}
        {ticks.map((h) => (
          <span
            key={`l${h}`}
            aria-hidden
            className="tabular absolute bottom-0 -translate-x-1/2 text-[0.66em] text-ink-3"
            style={{ left: x(h) }}
          >
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** A session's hue is its function's — the palette every card on the product uses. */
type TileTone = 'patient' | 'inpatients' | 'signoff' | 'discharge' | 'ai' | 'medication' | 'schedule'

const TILE: Record<TileTone, { tile: string; ink: string; bar: string }> = {
  patient: { tile: 'bg-card-patient-tint', ink: 'text-tone-patient-ink', bar: 'bg-tone-patient-bar' },
  inpatients: { tile: 'bg-card-inpatients-tint', ink: 'text-tone-inpatients-ink', bar: 'bg-tone-inpatients-bar' },
  signoff: { tile: 'bg-card-signoff-tint', ink: 'text-tone-signoff-ink', bar: 'bg-tone-signoff-bar' },
  discharge: { tile: 'bg-card-discharge-tint', ink: 'text-tone-discharge-ink', bar: 'bg-tone-discharge-bar' },
  ai: { tile: 'bg-card-ai-tint', ink: 'text-tone-ai-ink', bar: 'bg-tone-ai-bar' },
  medication: { tile: 'bg-card-medication-tint', ink: 'text-tone-medication-ink', bar: 'bg-tone-medication-bar' },
  schedule: { tile: 'bg-card-schedule-tint', ink: 'text-tone-schedule-ink', bar: 'bg-tone-schedule-bar' },
}

function toneFor(icon: string): TileTone {
  switch (icon) {
    case 'Stethoscope':
    case 'Video':
      return 'patient'
    case 'BedDouble':
      return 'inpatients'
    case 'PenLine':
    case 'Signature':
      return 'signoff'
    case 'DoorOpen':
      return 'discharge'
    case 'Sunrise':
      return 'ai'
    case 'Syringe':
      return 'medication'
    default:
      return 'schedule'
  }
}

function SessionTile({ entry: e, onPick }: { entry: CalendarEntry; onPick: () => void }) {
  const t = TILE[toneFor(e.icon)]
  const body = (
    <>
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', t.tile, t.ink)}>
        <Icon name={e.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{e.title}</span>
        <span className="tabular block truncate text-[0.8em] text-ink-3">
          {formatTime(e.at)}
          {e.until && `–${formatTime(e.until)}`}
          {e.critical && <span className="ml-1.5 font-semibold text-pri-critical-ink">· critical</span>}
        </span>
      </span>
    </>
  )
  const cls = 'flex items-center gap-2.5 rounded-[12px] border border-glass-hairline p-2 transition-colors duration-150 ease-out-clinical'
  return e.to ? (
    <Link to={e.to} onClick={onPick} title={e.detail} className={cx(cls, 'hover:bg-glass-fill-hover')}>
      {body}
    </Link>
  ) : (
    <div className={cls} title={e.detail}>
      {body}
    </div>
  )
}

function initialsOf(name: string): string {
  return name
    .replace(/^(Dr\.?|Sr\.?|Mr|Ms)\s+/, '')
    .split(/\s+/)
    .filter((w) => !w.endsWith('.'))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function BookedRow({ entry: e, onPick }: { entry: CalendarEntry; onPick: () => void }) {
  const body = (
    <>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-pill bg-section-opd-tile text-[0.78em] font-semibold text-brand">
        {initialsOf(e.title)}
        {e.done && (
          <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-pill bg-[var(--color-menu)] text-normal ring-1 ring-glass-hairline">
            <Icon name="Check" size={10} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate font-medium', e.done ? 'text-ink-3' : 'text-ink')}>{e.title}</span>
        {e.detail && <span className="block truncate text-[0.8em] text-ink-3">{e.detail}</span>}
      </span>
      <span className="tabular shrink-0 rounded-pill bg-glass-inset px-2 py-0.5 text-[0.78em] font-medium text-ink-2">
        {formatTime(e.at)}
      </span>
    </>
  )
  const cls = 'flex items-center gap-2.5 rounded-[12px] px-1.5 py-1.5 transition-colors duration-150 ease-out-clinical'
  return e.to ? (
    <Link to={e.to} onClick={onPick} className={cx(cls, 'hover:bg-glass-fill-hover')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** AI-608's reading of a date — what the day holds, who is booked, and a template's known habit. */
function DayBrief({ day, entries }: { day: Date; entries: CalendarEntry[] }) {
  const brief = dayBrief(day, entries)
  return (
    <section className="relative overflow-hidden rounded-[12px] border border-ai/20 bg-ai-soft px-4 py-3">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-ai" />
      <h4 className="flex items-center gap-1.5 text-[0.74em] font-bold tracking-[0.08em] text-ai uppercase">
        <Diamond size={9} />
        AI brief
      </h4>
      <p className="mt-1 text-[0.9em] leading-relaxed text-ink">{brief.text}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82em]">
        <Confidence band={brief.band} score={brief.confidence} />
        <WhyLink
          target={{
            touchpointId: `day-brief-${day.toDateString()}`,
            capabilityId: 'AI-608',
            claim: brief.text,
            confidence: brief.confidence,
            band: brief.band,
            computedAt: formatTime(NOW),
            inputs: brief.inputs,
            evidence: entries.map((e) => `${formatTime(e.at)} · ${e.title}${e.detail ? ` — ${e.detail}` : ''}`),
            model: 'capacity v1.4.0',
            limits: [
              'Reads the schedule and the bookings only — it does not know who will actually attend.',
              'A template’s habit (running over, finishing early) is a pattern from past weeks, not a forecast for this day.',
              'Changes made today are reflected once they are saved to the schedule.',
            ],
          }}
        />
      </div>
    </section>
  )
}
