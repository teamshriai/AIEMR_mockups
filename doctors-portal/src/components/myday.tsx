/**
 * My Day's own components.
 *
 * The brief for this screen is a brief about restraint: "scannable in under
 * three seconds", "no long paragraphs anywhere", "do NOT overload with icons",
 * "lots of white space". The first cut took that as "draw as little as
 * possible" and the result read as unfinished — text floating on the page
 * gradient, cards with no interior structure. This cut keeps the restraint in
 * the INFORMATION and puts the definition back in the SURFACES: one frosted
 * card per section, a visible rail through the day, one icon badge per
 * activity, big tabular numbers, a tinted status block per attention item.
 *
 * What is NOT on the surface, deliberately: AI provenance marks next to patient
 * names, predicted-wait chips, seen counts, next-token hints, the clinician's
 * registration number. All of it is one tap away on the inner screens.
 *
 * One rule is kept from §5.3 rather than the brief, because it is a safety
 * rule: colour is never the only carrier. Every status renders a SHAPE and a
 * WORD as well as a hue — a filled octagon and "Critical lab report identified", not a red dot.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Icon, IconButton, cx } from '@/components/primitives'
import type { DischargeRow as DischargeRowData } from '@/data/clinical'
import type { DayBlock, FinishItem, PatientCount, Urgency } from '@/data/myday'
import { NOW, formatDateTime, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import type { VoiceNote } from '@/store/clinical'

import { CountPill, SectionCard } from '@/components/calm'

// ───────────────────────────────────────────────────────────── Status shape

const URGENCY: Record<
  Urgency,
  { label: string; ink: string; soft: string; solid: string; shape: 'octagon' | 'triangle' | 'ring' }
> = {
  critical: {
    label: 'Critical',
    ink: 'text-pri-critical-ink',
    soft: 'bg-pri-critical-soft',
    solid: 'bg-pri-critical-fill text-pri-on-critical',
    shape: 'octagon',
  },
  warning: {
    label: 'Warning',
    ink: 'text-pri-warning-ink',
    soft: 'bg-pri-warning-soft',
    solid: 'bg-pri-warning-fill text-pri-on-warning',
    shape: 'triangle',
  },
  pending: {
    label: 'Pending',
    ink: 'text-pri-pending-ink',
    soft: 'bg-pri-pending-soft',
    solid: 'bg-pri-pending-fill text-pri-on-warning',
    shape: 'ring',
  },
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

/** The status shape on a tinted square — the leading element of an attention row. */
export function StatusBlock({ urgency, size = 'md' }: { urgency: Urgency; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-field',
        URGENCY[urgency].soft,
        size === 'md' ? 'size-10' : 'size-8',
      )}
    >
      <StatusDot urgency={urgency} size={size === 'md' ? 15 : 12} />
    </span>
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

// ────────────────────────────────────────────────────────── My patients

export function PatientCounts({ counts, columns = 4 }: { counts: PatientCount[]; columns?: 2 | 4 }) {
  return (
    <dl
      className={cx(
        'grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-2',
        columns === 4 && 'sm:grid-cols-[repeat(4,minmax(0,1fr))]',
      )}
    >
      {counts.map((c) => (
        <Link
          key={c.key}
          to={c.to}
          className={cx(
            'group lift flex min-h-[5.5rem] min-w-0 flex-col justify-between gap-2 rounded-panel bg-glass-inset px-3.5 py-3',
            'hover:bg-brand-soft',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-field bg-brand-soft text-brand transition-colors duration-[250ms] group-hover:bg-brand group-hover:text-brand-on">
              <Icon name={c.icon} size={17} />
            </span>
            <dd className="tabular text-3xl leading-none font-bold tracking-tight">{c.value}</dd>
          </span>
          <span className="min-w-0">
            <dt className="truncate text-[0.86em] font-medium text-ink-3">{c.label}</dt>
            {/* One quiet line: what is pending there. Counts only — the lists live on their own screens. */}
            {c.sub && <span className="tabular mt-0.5 block truncate text-[0.8em] text-ink-3">{c.sub}</span>}
          </span>
        </Link>
      ))}
    </dl>
  )
}

// ──────────────────────────────────────────────────── Pending today

/** One line of documentation or sign-off still the doctor's to close. The row is the link. */
export function FinishRow({ item }: { item: FinishItem }) {
  return (
    <li>
      <Link
        to={item.to}
        className={cx(
          'flex min-h-12 items-center gap-3 rounded-panel px-2 py-1.5',
          'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-field bg-glass-inset text-ink-2">
          <Icon name={item.icon} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold tracking-tight">{item.label}</span>
          {item.detail && <span className="block truncate text-[0.86em] text-ink-3">{item.detail}</span>}
        </span>
        <CountPill tone={item.urgency ?? 'neutral'}>{item.count}</CountPill>
        <Icon name="ChevronRight" size={16} className="shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}

// ──────────────────────────────────────────────────── Discharges today

/** A patient predicted to go home today, and what is in the way. The row opens the board. */
export function DischargeRow({ row }: { row: DischargeRowData }) {
  const p = patient(row.patientId)
  const clear = row.blockers.length === 0
  return (
    <li>
      <Link
        to="/discharge/board"
        className={cx(
          'flex min-h-14 items-center gap-3 rounded-panel px-2 py-2',
          'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        )}
      >
        <StatusBlock urgency={clear ? 'pending' : 'warning'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold tracking-tight">
            {p.name} <span className="tabular font-normal text-ink-3">· {row.bed}</span>
          </span>
          <span className="block truncate text-[0.86em] text-ink-3">
            {clear ? 'Cleared for discharge' : row.blockers.join(' · ')}
          </span>
        </span>
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
          'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-panel px-2 py-2 text-left',
          'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        )}
      >
        <StatusBlock urgency={urgency} />
        <span className="min-w-0 flex-1">
          {/* Colour + shape + the word. The word is plain ink, because none of
              the four hues clears 4.5:1 as text on this surface. */}
          <span className="block truncate font-semibold tracking-tight">{reason}</span>
          <span className="block truncate text-[0.88em] text-ink-3">{patientName}</span>
        </span>
        <Icon name="ChevronRight" size={16} className="shrink-0 text-ink-muted" />
      </button>
      <button
        type="button"
        onClick={onDictate}
        title={`Dictate a note about ${patientName}`}
        aria-label={`Dictate a note about ${patientName}`}
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
 * The doctor's own reminders — dictated from "Add today’s to-do note", attached
 * to no patient, and so never "to sign". Open ones first, newest first; ticked
 * ones sink below them, struck through, until they are deleted.
 *
 * The card only SHOWS the notes. Adding one is the header's job — a second add
 * control inside the card read as a duplicate of it.
 */
export function TodoNotesCard({
  notes,
  onToggle,
  onDelete,
  className,
}: {
  notes: VoiceNote[]
  onToggle: (id: string) => void
  onDelete: (note: VoiceNote) => void
  className?: string
}) {
  const open = notes.filter((n) => !n.done).length
  const sorted = [...notes].sort((a, b) => Number(a.done === true) - Number(b.done === true) || b.at.localeCompare(a.at))

  return (
    <SectionCard
      title="Today’s to-do notes"
      lift
      className={className}
      meta={notes.length > 0 && <CountPill tone={open > 0 ? 'pending' : 'neutral'}>{open > 0 ? open : 'All done'}</CountPill>}
    >
      {sorted.length === 0 ? (
        <p className="px-2 py-3 text-[0.95em] text-ink-2">
          Nothing noted for today yet. Notes you save with &ldquo;Add today&rsquo;s to-do note&rdquo; appear here.
        </p>
      ) : (
        <ul aria-label="Today’s to-do notes" className="divide-y divide-glass-hairline">
          {sorted.map((n) => (
            <TodoNoteRow key={n.id} note={n} onToggle={() => onToggle(n.id)} onDelete={() => onDelete(n)} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
