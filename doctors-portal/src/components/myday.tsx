/**
 * My Day's own components.
 *
 * My Day is a work surface, not a dashboard: three panels rather than seven
 * cards. The left panel holds the Schedule and Patients Today, the right one
 * Needs Action, and the month sits under both. What used to be a card is a
 * section inside a panel, set off by a hairline and a quiet label rather than
 * a frame, a tint and a shadow of its own.
 *
 * Restraint is in the INFORMATION as much as the surface. What is NOT here,
 * deliberately: AI provenance marks next to patient names, predicted-wait
 * chips, seen counts, next-token hints, the clinician's registration number,
 * and "See all" links that only repeat the nav. All of it is one tap away.
 *
 * Three type levels only — panel title, the name on a row, its metadata —
 * in three weights (400/500/600).
 *
 * One rule is kept from §5.3 rather than the brief, because it is a safety
 * rule: colour is never the only carrier. Every status renders a SHAPE and a
 * WORD as well as a hue — a filled octagon and "Critical lab report identified", not a red dot.
 */

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Icon, IconButton, cx } from '@/components/primitives'
import type { DayBlock, FinishItem, PatientListRow, RowMark, Urgency } from '@/data/myday'
import { NOW, formatDateTime, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import type { VoiceNote } from '@/store/clinical'

import { CountPill } from '@/components/calm'

// ───────────────────────────────────────────────────────────── Status shape

const URGENCY: Record<Urgency, { label: string; ink: string; shape: 'octagon' | 'triangle' | 'ring' }> = {
  critical: { label: 'Critical', ink: 'text-pri-critical-ink', shape: 'octagon' },
  warning: { label: 'Warning', ink: 'text-pri-warning-ink', shape: 'triangle' },
  pending: { label: 'Pending', ink: 'text-pri-pending-ink', shape: 'ring' },
}

/**
 * Shape + colour. The accessible name carries the word, so a screen reader and
 * a colour-blind reader get the same information a sighted one does.
 */
export function StatusDot({ urgency, size = 11 }: { urgency: Urgency; size?: number }) {
  const u = URGENCY[urgency]
  const fill = `var(--color-pri-${urgency})`
  /** `#F2C94C` at 11px is all but invisible on white, so every shape carries a
   *  hairline in its measured ink. */
  const edge = `var(--color-pri-${urgency}-ink)`

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={u.label} className="shrink-0">
      {u.shape === 'octagon' && (
        <polygon points="4,1 8,1 11,4 11,8 8,11 4,11 1,8 1,4" fill={fill} stroke={edge} strokeWidth="0.75" />
      )}
      {u.shape === 'triangle' && (
        <>
          <polygon points="6,0.8 11.6,11.2 0.4,11.2" fill={fill} stroke={edge} strokeWidth="0.75" />
          <polygon points="6,2.4 6,10.2 1.9,10.2" fill={edge} opacity="0.5" />
        </>
      )}
      {u.shape === 'ring' && (
        <>
          <circle cx="6" cy="6" r="5" fill={fill} />
          <circle cx="6" cy="6" r="5" fill="none" stroke={edge} strokeWidth="0.9" />
          <circle cx="6" cy="6" r="2" fill="var(--color-glass-fill-strong)" stroke={edge} strokeWidth="0.6" />
        </>
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────── Greeting

/** §5.4 note: the salutation follows the clock, the name follows the session. */
export function Greeting({ name }: { name: string }) {
  const h = NOW.getHours()
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const short = /^Dr\.?\s/.test(name) ? `Dr. ${name.split(' ').slice(-1)[0]}` : name
  return (
    <>
      {part}, {short}
    </>
  )
}

// The shared surface kit lives in calm.tsx; re-exported so existing imports hold.
export { SectionCard, CountPill, PillLink, PillTabs } from '@/components/calm'

// ────────────────────────────────────────────────────────────── Panels

/** A panel: one solid surface. What sits inside it are blocks and sections, not cards. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass-strong min-w-0 overflow-hidden rounded-card', className)}>{children}</div>
}

/**
 * A titled block of a panel — Schedule, Patients Today, Needs Action. Its title
 * is the top of the hierarchy: sentence case, semibold, one size.
 */
export function PanelBlock({
  title,
  meta,
  children,
  className,
}: {
  title: string
  /** Quiet, right of the title — a time, a count. */
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cx('min-w-0', className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-2">
        <h2 id={id} className="text-[1.05em] font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {meta}
      </header>
      {children}
    </section>
  )
}

/**
 * A section inside a block — OPD, Inpatients, Attention, Tasks, To-do notes. A
 * small muted label and a plain count; the hairline above it is the parent's.
 */
export function PanelSection({
  label,
  count,
  action,
  children,
}: {
  label: string
  count?: ReactNode
  /** The section's own controls, right of the label. */
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="min-w-0 px-3 pt-3 pb-2 sm:px-4">
      <header className="flex min-h-9 items-center justify-between gap-2 px-2 pb-1">
        <span className="flex items-baseline gap-2">
          <h3 id={id} className="text-[0.76em] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            {label}
          </h3>
          {count !== undefined && <span className="tabular text-[0.82em] text-ink-3">{count}</span>}
        </span>
        {action}
      </header>
      {children}
    </section>
  )
}

// ──────────────────────────────────────────────────────── Timeline blocks

function emphasise(summary: string, emphasis: DayBlock['emphasis']): ReactNode {
  if (!emphasis || emphasis.length === 0) return summary
  const pattern = emphasis.map((e) => e.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const parts = summary.split(new RegExp(`(${pattern})`))
  return parts.map((part, i) => {
    const hit = emphasis.find((e) => e.text === part)
    if (!hit) return part
    return (
      <strong key={i} className={cx('font-semibold', URGENCY[hit.tone].ink)}>
        {part}
      </strong>
    )
  })
}

export function TimelineBlock({
  block,
  current,
  past,
  aiActive,
}: {
  block: DayBlock
  current?: boolean
  past?: boolean
  aiActive: boolean
}) {
  return (
    <Link
      to={block.to}
      aria-current={current ? 'step' : undefined}
      className={cx(
        /*
         * The brief's `.schedule-item`: `padding: 12px 16px; border-left: 3px
         * solid transparent`. The current block colours the rule NORMAL blue
         * (the brief's "normal" — a block in progress is not an alert) and takes
         * the faintest tint of it. Nothing else in the row changes state.
         */
        'group relative grid h-full min-h-[3.75rem] grid-cols-[3.25rem_2.25rem_1fr] items-center gap-x-3 rounded-panel border-l-[3px] border-transparent px-3 py-3 sm:grid-cols-[3.75rem_2.25rem_1fr] sm:gap-x-4 sm:px-4',
        'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        current && 'border-pri-normal bg-pri-normal-soft',
      )}
    >
      {/* Time — the largest thing in the row. */}
      <span
        className={cx(
          'tabular text-right text-[1.05rem] leading-none font-bold sm:text-lg',
          current ? 'text-pri-normal-ink' : past ? 'text-ink-muted' : 'text-ink',
        )}
      >
        {formatTime(block.at)}
      </span>

      {/* The rail node: done (green check) · now (blue) · later (quiet). */}
      <span
        className={cx(
          'relative z-[1] grid size-9 place-items-center rounded-field ring-2 ring-glass-fill-strong',
          current
            ? 'bg-pri-normal-fill text-pri-on-normal'
            : past
              ? 'bg-pri-safe-soft text-pri-safe-ink'
              : 'bg-glass-inset text-ink-2',
        )}
      >
        <Icon name={past && !current ? 'Check' : block.icon} size={16} />
      </span>

      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx('truncate font-semibold tracking-tight', past && !current && 'text-ink-2')}>
            {block.title}
          </span>
          {current && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-pri-normal-fill px-2 py-0.5 text-[0.72em] font-bold tracking-wide text-pri-on-normal uppercase">
              <span aria-hidden className="size-1.5 rounded-pill bg-pri-on-normal" />
              Now
            </span>
          )}
          {/* §4.8 — with the fabric off the ◆ is HIDDEN, not greyed. */}
          {block.ai && aiActive && <Diamond size={10} />}
        </span>
        {/* On the current block's blue tint `ink-3` measures 4.18:1 in night, so
            the block in progress takes the stronger ink — which also reads as
            "this one is live", the intended emphasis. */}
        <span
          className={cx(
            'mt-0.5 block truncate text-[0.9em]',
            current ? 'text-ink-2' : past ? 'text-ink-muted' : 'text-ink-3',
          )}
        >
          {emphasise(block.summary, block.emphasis)}
        </span>
      </span>
    </Link>
  )
}

/**
 * The day. A rail runs through the icon badges so the sequence reads as a day
 * rather than a list; the block covering NOW is lifted on the brand tint.
 */
export function DayTimeline({
  blocks,
  currentId,
  aiActive,
}: {
  blocks: DayBlock[]
  currentId?: string
  aiActive: boolean
}) {
  return (
    <ol className="relative flex min-h-0 flex-1 flex-col">
      {/* 3px rule + 0.75rem padding + time column + gap + half the 2.25rem badge. */}
      <span
        aria-hidden
        className="absolute top-5 bottom-5 left-[calc(3px+0.75rem+3.25rem+0.75rem+1.125rem-1px)] w-0.5 rounded-pill bg-glass-hairline sm:left-[calc(3px+1rem+3.75rem+1rem+1.125rem-1px)]"
      />
      {blocks.map((b) => (
        <li key={b.id} className="relative flex min-h-0 flex-1 flex-col">
          <TimelineBlock block={b} current={b.id === currentId} past={b.at < NOW && b.id !== currentId} aiActive={aiActive} />
        </li>
      ))}
    </ol>
  )
}

// ────────────────────────────────────────────────────────── Patient lists

/** Which of Patients Today's sections a list sits in — it sets the ground, the header icon and the row tiles. */
export type PatientGroupTone = 'opd' | 'inpatients' | 'stroke'

const GROUP_TONE: Record<PatientGroupTone, { ground: string; tile: string; ink: string }> = {
  opd: { ground: 'bg-section-opd', tile: 'bg-section-opd-tile', ink: 'text-brand' },
  inpatients: { ground: 'bg-section-inpatients', tile: 'bg-section-inpatients-tile', ink: 'text-section-inpatients-ink' },
  stroke: { ground: 'bg-card-stroke-tint', tile: 'bg-card-stroke-line', ink: 'text-ink-2' },
}

/**
 * One of Patients Today's sections — OPD, Inpatients, or a stroke clinician's
 * telestroke queue. Told apart before a word is read: its function's soft hue
 * (blue for OPD, green for Inpatients), its icon beside a bold label, the same
 * hue behind every row's icon, and a clear gap from the next section.
 */
export function PatientGroup({
  label,
  icon,
  tone,
  count,
  children,
}: {
  label: string
  icon: string
  tone: PatientGroupTone
  count: number
  children: ReactNode
}) {
  const id = useId()
  const t = GROUP_TONE[tone]
  return (
    <section aria-labelledby={id} className={cx('min-w-0 rounded-panel px-2 pt-2 pb-1.5 sm:px-3', t.ground)}>
      <header className="mb-1.5 flex min-h-9 items-center gap-2 border-b border-glass-hairline px-1 pb-1.5">
        <Icon name={icon} size={17} className={cx('shrink-0', t.ink)} />
        <h3 id={id} className="text-[0.84em] font-semibold tracking-[0.06em] text-ink uppercase">
          {label}
        </h3>
        <span className="tabular text-[0.84em] text-ink-3">{count}</span>
      </header>
      {children}
    </section>
  )
}

const MARK_TONE: Record<RowMark['tone'], string> = {
  critical: 'bg-pri-critical-soft text-pri-critical-ink',
  attention: 'bg-pri-warning-soft text-pri-warning-ink',
  normal: 'bg-pri-normal-soft text-pri-normal-ink',
  neutral: 'text-ink-3',
}

/**
 * A status as a picture first: the coloured icon, then a small word. A mark
 * that would repeat down the list — Follow-up, Seen — is the icon alone; its
 * word is in the tooltip and the row's accessible name.
 */
function Mark({ mark }: { mark: RowMark }) {
  if (mark.iconOnly) {
    return (
      <span title={mark.label} className="inline-grid size-6 place-items-center text-ink-3">
        <Icon name={mark.icon} size={15} />
        <span className="sr-only">{mark.label}</span>
      </span>
    )
  }
  return (
    <span
      className={cx(
        'inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-chip text-[0.8em]',
        mark.tone === 'neutral' ? 'px-0.5' : 'px-1.5 font-medium',
        MARK_TONE[mark.tone],
      )}
    >
      <Icon name={mark.icon} size={14} className="shrink-0" />
      <span className="truncate">{mark.label}</span>
    </span>
  )
}

/**
 * The rows of one Patients Today section. Every row has the same structure, on
 * a grid, so the eye runs down columns rather than reading lines:
 *
 *   place tile · name and bed · kind · status · ›
 *
 * The tile carries where the patient is (OPD, Ward, ICU, ED) at full strength,
 * and a red dot on its corner when the patient is high risk, so a high-risk
 * patient stands out down the left edge. Kind and status sit in fixed slots on
 * the right, so every status starts at the same place in both sections. Below
 * `sm` the marks drop to a line under the name. Every row opens the record.
 * About five rows show (seven from `lg`, where the column has the height); the
 * list scrolls inside its section, with a soft fade while there is more.
 */
export function PatientList({
  rows,
  tone,
  label,
  empty,
}: {
  rows: PatientListRow[]
  tone: PatientGroupTone
  /** The list's accessible name. */
  label: string
  empty: string
}) {
  const listRef = useRef<HTMLUListElement>(null)
  /** More below the fold of the list — shown as a soft fade, so a cut-off row reads as "scroll", not as broken. */
  const [more, setMore] = useState(false)
  const measure = () => {
    const list = listRef.current
    if (list) setMore(list.scrollHeight - list.scrollTop - list.clientHeight > 4)
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const ro = new ResizeObserver(() => {
      setMore(list.scrollHeight - list.scrollTop - list.clientHeight > 4)
    })
    ro.observe(list)
    return () => ro.disconnect()
  }, [rows.length])

  if (rows.length === 0) return <p className="px-1 py-3 text-[0.95em] text-ink-2">{empty}</p>

  const t = GROUP_TONE[tone]

  return (
    <ul
      ref={listRef}
      aria-label={label}
      onScroll={measure}
      className={cx(
        'thin-scroll relative max-h-[16.5rem] min-h-0 space-y-0.5 overflow-y-auto lg:max-h-[22rem]',
        more && '[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]',
      )}
    >
      {rows.map((r) => {
        const p = patient(r.patientId)
        const critical = r.status?.tone === 'critical'
        const marks = r.kind || r.status
        return (
          <li key={r.patientId}>
            <Link
              to={`/patient/${p.uhid}/record`}
              className={cx(
                'grid min-h-12 grid-cols-[2.25rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-0.5 rounded-panel px-1 py-1.5',
                'sm:grid-cols-[2.25rem_minmax(0,1fr)_7.5em_11.5em_1rem]',
                'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
              )}
            >
              {/* Where they are, at full strength. Read out and on hover, so the icon never carries it alone. */}
              <span
                title={r.place.label}
                className={cx('relative row-span-2 grid size-9 place-items-center rounded-field sm:row-span-1', t.tile, t.ink)}
              >
                <Icon name={r.place.icon} size={18} />
                <span className="sr-only">{r.place.label}</span>
                {critical && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 size-2.5 rounded-pill bg-pri-critical ring-2 ring-[var(--color-glass-fill-strong)]"
                  />
                )}
              </span>

              <span className={cx('min-w-0 truncate font-medium', r.done ? 'text-ink-3' : 'text-ink')}>
                {p.name}
                {r.detail && <span className="tabular font-normal text-ink-3"> · {r.detail}</span>}
              </span>

              {/* Kind and status: a line under the name on a phone, two fixed columns from `sm`. */}
              {marks && (
                <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2 sm:contents">
                  {r.kind && (
                    <span className="flex min-w-0 sm:col-start-3 sm:row-start-1">
                      <Mark mark={r.kind} />
                    </span>
                  )}
                  {r.status && (
                    <span className="flex min-w-0 sm:col-start-4 sm:row-start-1">
                      <Mark mark={r.status} />
                    </span>
                  )}
                </span>
              )}

              <Icon
                name="ChevronRight"
                size={16}
                className="col-start-3 row-span-2 row-start-1 shrink-0 text-ink-muted sm:col-start-5 sm:row-span-1"
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// ──────────────────────────────────────────────────── Pending today

/**
 * One line of documentation or sign-off still the doctor's to close. The row is
 * the link. The count is plain unless the item is urgent.
 */
export function FinishRow({ item }: { item: FinishItem }) {
  const urgent = item.urgency === 'critical' || item.urgency === 'warning'
  return (
    <li>
      <Link
        to={item.to}
        className={cx(
          'flex min-h-11 items-center gap-3 rounded-panel px-2 py-1.5',
          'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        )}
      >
        <span className="grid w-5 shrink-0 place-items-center text-ink-3">
          <Icon name={item.icon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label}</span>
          {item.detail && <span className="block truncate text-[0.86em] text-ink-3">{item.detail}</span>}
        </span>
        <CountPill tone={urgent ? item.urgency : 'neutral'}>{item.count}</CountPill>
        <Icon name="ChevronRight" size={16} className="shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}

// ──────────────────────────────────────────────────── Needs my attention

export function AttentionRow({
  urgency,
  reason,
  patientName,
  onOpen,
  onDictate,
}: {
  urgency: Urgency
  reason: string
  patientName: string
  onOpen: () => void
  onDictate: () => void
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className={cx(
          'flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-panel px-2 py-1.5 text-left',
          'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        )}
      >
        {/* The shape alone — no tinted square behind it. */}
        <span className="grid w-5 shrink-0 place-items-center">
          <StatusDot urgency={urgency} size={12} />
        </span>
        <span className="min-w-0 flex-1">
          {/* Colour + shape + the word. The word is plain ink, because none of
              the four hues clears 4.5:1 as text on this surface. */}
          <span className="block truncate font-medium">{reason}</span>
          <span className="block truncate text-[0.86em] text-ink-3">{patientName}</span>
        </span>
        <Icon name="ChevronRight" size={16} className="shrink-0 text-ink-muted" />
      </button>
      <button
        type="button"
        onClick={onDictate}
        title={`Add note about ${patientName}`}
        aria-label={`Add note about ${patientName}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-3 transition-colors duration-150 hover:bg-brand-soft hover:text-brand"
      >
        <Icon name="Mic" size={16} />
      </button>
    </li>
  )
}

// ──────────────────────────────────────────────── Today’s to-do notes

/**
 * The saved time on the note's own clock. The rest of My Day runs on the
 * frozen demo moment, but a note is saved now, and "08:40" on something said a
 * minute ago would be a lie.
 */
function savedAt(iso: string): string {
  const at = new Date(iso)
  const today = new Date()
  return at.toDateString() === today.toDateString() ? `Saved ${formatTime(at)}` : `Saved ${formatDateTime(at)}`
}

/** One to-do: a tick, the words (three lines, more on tap), when it was saved, and a way to delete it. */
export function TodoNoteRow({
  note,
  onToggle,
  onDelete,
}: {
  note: VoiceNote
  onToggle: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const expandedRef = useRef(expanded)
  const done = note.done === true
  const preview = note.body.replace(/\s+/g, ' ').slice(0, 48)

  /** Whether three lines hide anything — measured, so a short note never offers "Show more". */
  useEffect(() => {
    expandedRef.current = expanded
    const el = textRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!expandedRef.current) setClamped(el.scrollHeight > el.clientHeight + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [note.body, expanded])

  return (
    <li className="flex items-start gap-1 py-1">
      <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-pill hover:bg-glass-fill-hover">
        <input
          type="checkbox"
          checked={done}
          onChange={onToggle}
          aria-label={done ? `Mark as not done: ${preview}` : `Mark as done: ${preview}`}
          className="size-4.5 cursor-pointer accent-[var(--color-brand)]"
        />
      </label>
      <div className="min-w-0 flex-1 py-2.5">
        <p
          ref={textRef}
          className={cx(
            'text-[0.95em] leading-snug break-words whitespace-pre-line',
            !expanded && 'line-clamp-3',
            done ? 'text-ink-3 line-through decoration-ink-muted' : 'text-ink',
          )}
        >
          {note.body}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.8em] text-ink-3">
          <span className="tabular">{savedAt(note.at)}</span>
          {done && (
            <>
              <span aria-hidden>·</span>
              <span>Done</span>
            </>
          )}
          {(clamped || expanded) && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="min-h-8 rounded-pill px-1 font-semibold text-brand hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            </>
          )}
        </p>
      </div>
      <IconButton
        icon="Trash2"
        label="Delete this to-do note"
        onClick={onDelete}
        className="mt-0.5 size-10 text-ink-3 hover:text-abnormal"
        size={15}
      />
    </li>
  )
}

/**
 * The doctor's own reminders — attached to no patient, and so never "to sign".
 * Open ones first, newest first; ticked ones sink below them, struck through,
 * until they are deleted.
 *
 * A section of Needs Action rather than a card of its own: these are the
 * doctor's tasks too. Adding one is the section's own job, and there is exactly
 * one way in on each side: the microphone dictates, the plus types. Nothing
 * else on the screen adds a to-do note.
 */
export function TodoNotesSection({
  notes,
  onAdd,
  onToggle,
  onDelete,
}: {
  notes: VoiceNote[]
  /** Opens the note dialog, listening or ready to type. */
  onAdd: (mode: 'voice' | 'type') => void
  onToggle: (id: string) => void
  onDelete: (note: VoiceNote) => void
}) {
  const open = notes.filter((n) => !n.done).length
  const sorted = [...notes].sort((a, b) => Number(a.done === true) - Number(b.done === true) || b.at.localeCompare(a.at))

  return (
    <PanelSection
      label="To-do notes"
      count={notes.length > 0 ? (open > 0 ? open : 'All done') : undefined}
      action={
        <span className="flex items-center gap-0.5">
          <IconButton
            icon="Mic"
            label="Dictate a to-do note"
            onClick={() => onAdd('voice')}
            compact
            className="text-brand"
            size={15}
          />
          <IconButton icon="Plus" label="Type a to-do note" onClick={() => onAdd('type')} compact size={15} />
        </span>
      }
    >
      {sorted.length === 0 ? (
        <p className="px-2 pb-2 text-[0.95em] text-ink-2">
          Nothing noted for today yet. Dictate one with the microphone, or type one with +.
        </p>
      ) : (
        <ul aria-label="To-do notes" className="divide-y divide-glass-hairline">
          {sorted.map((n) => (
            <TodoNoteRow key={n.id} note={n} onToggle={() => onToggle(n.id)} onDelete={() => onDelete(n)} />
          ))}
        </ul>
      )}
    </PanelSection>
  )
}
