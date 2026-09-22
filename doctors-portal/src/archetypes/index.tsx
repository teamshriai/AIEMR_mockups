/**
 * Layout shells for the archetypes (§10.1), built in the atlas's own order —
 * by usage, since "ARC-15 and ARC-01 together account for 75 of 256 screens."
 *
 * Each one carries the behavioural rules the atlas attaches to that shape, so a
 * screen gets them by using the shell rather than by remembering them.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { RankedSortControl } from '@/components/ai'
import { Card, Chip, EmptyState, Icon, Table, Td, Th, Tr, cx } from '@/components/primitives'

// ────────────────────────────────────────────── ARC-20 Dashboard / tile grid

/** Responsive per S-06-01: ">=1440 4 columns · 1024–1439 2 columns · <768 1 column, priority order". */
export function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
  )
}

// ───────────────────────────────────────────────── ARC-01 Worklist / queue

export interface WorklistColumn<T> {
  key: string
  label: string
  /** Rendered per row. */
  cell: (row: T) => ReactNode
  className?: string
  /** Hidden below the md breakpoint, for the phone layout. */
  secondary?: boolean
}

/**
 * ARC-01's rules, all enforced here rather than per screen:
 *   • a sticky header AND a row-count line;
 *   • the current sort is always named in the header;
 *   • ↑/↓ move selection, Enter opens, Space previews, / focuses the filter;
 *   • selection survives a background refresh;
 *   • with the AI off it reverts to the deterministic sort "WITHOUT RE-ORDERING
 *     UNDER THE USER MID-SCAN" — which is why the sort is applied on mount and
 *     on an explicit change, never reactively mid-interaction.
 */
export function Worklist<T>({
  rows,
  columns,
  rowKey,
  onOpen,
  onPreview,
  aiSort,
  onSortChange,
  sortCapability,
  aiSortLabel = 'AI acuity',
  deterministicLabel = 'Chronological',
  filters,
  emptyWhy,
  emptyAction,
  caption,
  pinned,
  pinnedLabel,
}: {
  rows: T[]
  columns: WorklistColumn<T>[]
  rowKey: (row: T) => string
  onOpen?: (row: T) => void
  onPreview?: (row: T) => void
  aiSort?: boolean
  onSortChange?: (aiSort: boolean) => void
  sortCapability?: string
  aiSortLabel?: string
  deterministicLabel?: string
  filters?: ReactNode
  emptyWhy: string
  emptyAction?: ReactNode
  caption: string
  /** Rows pinned above the list — S-06-01's "needs attention" group. */
  pinned?: T[]
  pinnedLabel?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const all = [...(pinned ?? []), ...rows]

  // ↑/↓ move selection, Enter opens, Space previews.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT') return
      if (!containerRef.current?.contains(document.activeElement) && selected === null) return

      const index = all.findIndex((r) => rowKey(r) === selected)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(rowKey(all[Math.min(all.length - 1, index + 1)] ?? all[0]))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(rowKey(all[Math.max(0, index - 1)] ?? all[0]))
      } else if (e.key === 'Enter' && index >= 0) {
        e.preventDefault()
        onOpen?.(all[index])
      } else if (e.key === ' ' && index >= 0 && onPreview) {
        e.preventDefault()
        onPreview(all[index])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [all, rowKey, selected, onOpen, onPreview])

  const head = (
    <>
      {columns.map((c) => (
        <Th key={c.key} className={cx(c.className, c.secondary && 'hidden md:table-cell')}>
          {c.label}
        </Th>
      ))}
    </>
  )

  function renderRow(row: T, emphasis?: boolean) {
    const key = rowKey(row)
    return (
      <Tr
        key={key}
        selected={selected === key}
        onClick={() => {
          setSelected(key)
          onOpen?.(row)
        }}
        className={emphasis ? 'bg-abnormal-soft/40' : undefined}
      >
        {columns.map((c) => (
          <Td key={c.key} className={cx(c.className, c.secondary && 'hidden md:table-cell')}>
            {c.cell(row)}
          </Td>
        ))}
      </Tr>
    )
  }

  return (
    <div ref={containerRef}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
        {onSortChange && sortCapability && (
          <RankedSortControl
            aiSort={aiSort ?? true}
            onChange={onSortChange}
            aiLabel={aiSortLabel}
            deterministicLabel={deterministicLabel}
            capabilityId={sortCapability}
          />
        )}
      </div>

      <Card className="overflow-hidden">
        {all.length === 0 ? (
          <EmptyState icon="Inbox" why={emptyWhy} action={emptyAction} />
        ) : (
          <Table
            head={head}
            caption={caption}
            rowCount={`${all.length} ${all.length === 1 ? 'row' : 'rows'}${
              pinned && pinned.length ? ` · ${pinned.length} pinned to the top` : ''
            } · ↑↓ to move, Enter to open`}
          >
            {pinned && pinned.length > 0 && (
              <>
                <tr>
                  <td colSpan={columns.length} className="bg-abnormal-soft/50 px-4 py-1.5">
                    <span className="flex items-center gap-2 text-[0.8em] font-semibold tracking-wider text-abnormal uppercase">
                      <Icon name="TriangleAlert" size={13} />
                      {pinnedLabel ?? 'Needs attention'} ({pinned.length})
                    </span>
                  </td>
                </tr>
                {pinned.map((r) => renderRow(r, true))}
              </>
            )}
            {rows.map((r) => renderRow(r))}
          </Table>
        )}
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────────── ARC-04 Board / kanban

export interface BoardColumn<T> {
  key: string
  label: string
  /** Column headers carry counts and a capacity signal. */
  capacity?: string
  tone?: 'neutral' | 'caution' | 'abnormal' | 'normal' | 'critical'
  rows: T[]
}

/**
 * ARC-04's load-bearing rule: "A DRAG THAT VIOLATES A HARD RULE IS REFUSED WITH
 * AN INLINE REASON ON THE TARGET", never silently reverted. `canDrop` returns
 * either true or the reason it is refused, and the reason is shown on the
 * column you tried to drop onto.
 */
export function Board<T>({
  columns,
  rowKey,
  renderCard,
  asOf,
  legend,
  canDrop,
  onDrop,
}: {
  columns: BoardColumn<T>[]
  rowKey: (row: T) => string
  renderCard: (row: T) => ReactNode
  asOf?: ReactNode
  legend?: ReactNode
  canDrop?: (row: T, columnKey: string) => true | string
  onDrop?: (row: T, columnKey: string) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<{ column: string; reason: string } | null>(null)

  const flat = columns.flatMap((c) => c.rows)

  return (
    <div>
      {(legend || asOf) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">{legend}</div>
          {asOf}
        </div>
      )}

      <div className="thin-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
        {columns.map((col) => {
          const isRefused = refusal?.column === col.key
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                if (!dragging || !canDrop) return
                const row = flat.find((r) => rowKey(r) === dragging)
                if (!row) return
                const verdict = canDrop(row, col.key)
                if (verdict === true) {
                  e.preventDefault()
                  setRefusal(null)
                } else {
                  setRefusal({ column: col.key, reason: verdict })
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                const row = flat.find((r) => rowKey(r) === dragging)
                if (row && canDrop?.(row, col.key) === true) onDrop?.(row, col.key)
                setDragging(null)
                setRefusal(null)
              }}
              className={cx(
                'flex w-72 shrink-0 flex-col gap-2 rounded-card p-2 md:w-auto',
                isRefused ? 'bg-abnormal-soft ring-1 ring-abnormal/40' : 'bg-glass-fill-muted',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-2 pt-1.5">
                <h3 className="flex items-center gap-2 text-[0.88em] font-semibold">
                  {col.label}
                  <Chip tone={col.tone ?? 'neutral'}>{col.rows.length}</Chip>
                </h3>
                {col.capacity && <span className="text-[0.82em] text-ink-3">{col.capacity}</span>}
              </header>

              {/* The refusal reason lands on the target, not in a toast. */}
              {isRefused && (
                <p className="mx-1 flex items-start gap-1.5 rounded-panel bg-abnormal-soft px-2.5 py-2 text-[0.84em] font-medium text-abnormal">
                  <Icon name="Ban" size={13} className="mt-0.5 shrink-0" />
                  {refusal.reason}
                </p>
              )}

              <div className="flex flex-col gap-2">
                {col.rows.map((row) => (
                  <div
                    key={rowKey(row)}
                    draggable={Boolean(canDrop)}
                    onDragStart={() => setDragging(rowKey(row))}
                    onDragEnd={() => {
                      setDragging(null)
                      setRefusal(null)
                    }}
                    className={cx(dragging === rowKey(row) && 'opacity-50')}
                  >
                    {renderCard(row)}
                  </div>
                ))}
                {col.rows.length === 0 && (
                  <p className="px-2 py-4 text-center text-[0.86em] text-ink-3">Nothing here right now.</p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ────────────────────────────────────────── ARC-15 Form / single-page capture

/**
 * ARC-15's rules: one column at <=1024px and two above; an autosave timestamp
 * in the sticky bar; and validation ON BLUR, NEVER ON KEYSTROKE.
 */
export function FormGroups({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div className={cx('grid gap-5', columns === 2 ? 'lg:grid-cols-2' : 'grid-cols-1')}>{children}</div>
  )
}

export function FieldGroup({
  title,
  hint,
  children,
  span,
}: {
  title: string
  hint?: string
  children: ReactNode
  span?: boolean
}) {
  return (
    <Card as="section" className={cx('p-5', span && 'lg:col-span-2')}>
      <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-[0.88em] text-ink-3">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </Card>
  )
}

// ──────────────────────────────────────────────── ARC-14 Checklist runner

export function Checklist({
  items,
  footer,
}: {
  items: {
    key: string
    label: string
    answer: ReactNode
    /** The consequence of this answer — what makes an unknown usable. */
    consequence: ReactNode
    state: 'ok' | 'blocks' | 'unknown' | 'contraindicated' | 'resolved'
    actions?: ReactNode
    subFlow?: ReactNode
  }[]
  footer?: ReactNode
}) {
  const TONE = {
    ok: { chip: 'normal', icon: 'Check', label: 'OK' },
    resolved: { chip: 'normal', icon: 'Check', label: 'Resolved' },
    blocks: { chip: 'abnormal', icon: 'Ban', label: 'Blocks' },
    unknown: { chip: 'caution', icon: 'CircleHelp', label: 'Unknown' },
    contraindicated: { chip: 'critical', icon: 'OctagonAlert', label: 'Contraindicated' },
  } as const

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-glass-hairline">
        {items.map((item) => {
          const tone = TONE[item.state]
          return (
            <li key={item.key} className="px-5 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="tabular mt-0.5 text-[0.92em] text-ink-2">{item.answer}</p>
                </div>
                <Chip tone={tone.chip} icon={tone.icon}>
                  {tone.label}
                </Chip>
              </div>
              <p className="mt-1.5 text-[0.9em] text-ink-3">{item.consequence}</p>
              {item.subFlow && <div className="mt-2.5">{item.subFlow}</div>}
              {item.actions && <div className="mt-2.5 flex flex-wrap gap-2">{item.actions}</div>}
            </li>
          )
        })}
      </ul>
      {footer && <div className="border-t border-glass-hairline px-5 py-4">{footer}</div>}
    </Card>
  )
}

// ────────────────────────────────────── ARC-13 Clock / timer (C-25, C-26)

/**
 * C-26 clock ring. "Clock state carried by RING FILL AND A TEXT LABEL — never
 * colour alone", and tabular figures because "a clock whose digits shift width
 * is unreadable at a glance."
 */
export function ClockRing({
  elapsedMin,
  targetMin,
  label,
  state,
  size = 76,
}: {
  elapsedMin: number | null
  targetMin: number | null
  label: string
  state: 'DONE' | 'RUNNING' | 'PENDING' | 'BREACH'
  size?: number
}) {
  const pct = targetMin && elapsedMin !== null ? Math.min(1, elapsedMin / targetMin) : 0
  const stroke = 6
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  const colour =
    state === 'BREACH'
      ? 'var(--color-abnormal)'
      : state === 'DONE'
        ? 'var(--color-normal)'
        : state === 'RUNNING'
          ? 'var(--color-caution)'
          : 'var(--color-inactive)'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${label}: ${state}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-glass-hairline)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-lg leading-none font-semibold">
            {elapsedMin === null ? '—' : elapsedMin}
          </span>
          {targetMin !== null && <span className="tabular text-[0.7em] text-ink-3">/ {targetMin}</span>}
        </span>
      </div>
      {/* The text label, because ring fill alone is not enough. */}
      <span
        className={cx(
          'text-[0.72em] font-semibold tracking-wide uppercase',
          state === 'BREACH' ? 'text-abnormal' : state === 'DONE' ? 'text-normal' : state === 'RUNNING' ? 'text-caution' : 'text-inactive',
        )}
      >
        {state}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────── ARC-12 Command wall frame

/**
 * "Z5 only. No Z1, no Z2, no input affordances, no Z7b bubble. Read at 3–4
 * metres, runs unattended for a shift... A stale wall DIMS and states its
 * last-good timestamp in large type. IT MUST ALSO WORK ON A PHONE."
 */
export function WallFrame({
  title,
  asOf,
  stale,
  children,
  onExit,
}: {
  title: string
  asOf: string
  stale?: boolean
  children: ReactNode
  onExit?: () => void
}) {
  return (
    <div className={cx('min-h-dvh px-4 py-4 md:px-8 md:py-6', stale && 'opacity-45')}>
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <div className="flex items-center gap-3">
          <p className="tabular text-[0.95em] text-ink-3 md:text-xl">as of {asOf}</p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="glass rounded-pill px-3 py-1.5 text-[0.82em] text-ink-3 hover:bg-glass-fill-hover"
              title="Leave the wall view"
            >
              exit wall
            </button>
          )}
        </div>
      </header>

      {stale && (
        <p className="tabular mb-5 rounded-card bg-caution-soft px-6 py-5 text-center text-2xl font-bold text-caution md:text-5xl">
          LAST GOOD DATA {asOf}
          <span className="mt-2 block text-base font-medium md:text-xl">
            A wall showing confidently wrong data is worse than one showing none.
          </span>
        </p>
      )}

      {children}
    </div>
  )
}
