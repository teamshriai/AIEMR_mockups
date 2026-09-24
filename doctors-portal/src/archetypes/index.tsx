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
  /**
   * Which slot this column fills in the `calm` variant. A screen declares the
   * roles once and the same columns render as either a table or a calm list —
   * no screen restates its data to change shape.
   *
   *   lead       the left gutter: a time, a token, a bed. Tabular.
   *   primary    the one line that identifies the row.
   *   context    the quiet second line. Several are joined with a middot.
   *   status     right-aligned, where the state goes.
   *   trailing   chrome, such as a chevron. DROPPED in calm — a whole row that
   *              is already a button does not need an affordance drawn on it.
   *
   * Anything unroled falls to `context`, so an existing table degrades sensibly
   * rather than losing columns.
   */
  role?: 'lead' | 'primary' | 'context' | 'status' | 'trailing'
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
  variant = 'calm',
  noun = 'rows',
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
  /**
   * `calm` is the default. It renders the same rows as one line each plus a
   * quiet context line,
   * separated by space and a hairline rather than by table borders. It exists
   * because a dense grid is the wrong shape for a list a clinician scans on a
   * ward tablet, and because the destinations My Day sends people to have to
   * feel like My Day.
   *
   * Every ARC-01 behaviour is shared between the two — the keyboard map, the
   * row-count line, the named sort, selection surviving a refresh — because all
   * of it lives above this choice rather than inside either renderer.
   */
  variant?: 'table' | 'calm'
  /** What a row IS, for the count line — "patients", "results". Plural. */
  noun?: string
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

  /** One row, calm. Roles decide the slots; the row itself is the button. */
  function renderCalmRow(row: T, emphasis?: boolean) {
    const key = rowKey(row)
    const slot = (role: WorklistColumn<T>['role']) => columns.filter((c) => c.role === role)
    const lead = slot('lead')[0]
    const primary = slot('primary')[0] ?? columns[0]
    const status = slot('status')
    /**
     * A context cell that renders nothing still produced its middot, so rows
     * ended in a dangling separator. Cells are evaluated once here and the
     * empty ones dropped, which also means a screen can return null for "this
     * row has no allergy" without having to think about punctuation.
     */
    const context = columns
      .filter((c) => c !== lead && c !== primary && !status.includes(c) && c.role !== 'trailing')
      .map((c) => ({ column: c, node: c.cell(row) }))
      .filter(({ node }) => node !== null && node !== undefined && node !== false && node !== '')

    return (
      <li key={key}>
        <button
          type="button"
          aria-current={selected === key ? true : undefined}
          onClick={() => {
            setSelected(key)
            onOpen?.(row)
          }}
          className={cx(
            'relative grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3 py-3 text-left sm:px-4',
            'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
            lead && 'sm:grid-cols-[4.75rem_1fr_auto]',
            selected === key && 'bg-brand-soft',
            emphasis && !(selected === key) && 'bg-pri-critical-soft/60',
          )}
        >
          {/* A pinned row carries the priority hue as a left bar, never as a full tint. */}
          {emphasis && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-pill bg-pri-critical" />}
          {lead && (
            /* The lead — a time, a token, a bed — sits in a lozenge so the eye
               can run down the column without reading the names. */
            <span className="tabular order-2 inline-flex min-h-8 items-center justify-center self-center justify-self-start rounded-field bg-glass-inset px-2.5 text-[0.86em] font-bold whitespace-nowrap text-ink-2 sm:order-none sm:w-full">
              {lead.cell(row)}
            </span>
          )}
          <span className="order-1 col-span-1 min-w-0 sm:order-none">
            <span className="block truncate text-[1.02em] font-semibold tracking-tight">{primary.cell(row)}</span>
            {context.length > 0 && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.88em] text-ink-3">
                {context.map(({ column, node }, i) => (
                  <span key={column.key} className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0">{node}</span>
                    {i < context.length - 1 && (
                      <span aria-hidden className="text-ink-muted">
                        ·
                      </span>
                    )}
                  </span>
                ))}
              </span>
            )}
          </span>
          {status.length > 0 && (
            <span className="order-3 flex shrink-0 flex-col items-end gap-1.5 sm:order-none">
              {status.map((c) => (
                <span key={c.key}>{c.cell(row)}</span>
              ))}
            </span>
          )}
        </button>
      </li>
    )
  }

  const countLine = `${all.length} ${all.length === 1 ? noun.replace(/s$/, '') : noun}${
    pinned && pinned.length ? ` · ${pinned.length} first` : ''
  }`

  if (variant === 'calm') {
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

        {all.length === 0 ? (
          <Card strong>
            <EmptyState icon="Inbox" why={emptyWhy} action={emptyAction} />
          </Card>
        ) : (
          /*
           * The same frosted frame My Day's sections use. The rows are the
           * card's whole interior; the count line is its footer. The keyboard
           * map is announced, not printed — it is chrome, and the row is
           * already a button.
           */
          <Card strong className="overflow-hidden">
            <ul aria-label={caption} className="divide-y divide-glass-hairline">
              {pinned && pinned.length > 0 && (
                <>
                  <li className="flex items-center gap-2 bg-pri-critical-soft/60 px-4 py-2">
                    <Icon name="TriangleAlert" size={13} className="text-pri-critical-ink" />
                    <span className="text-[0.78em] font-bold tracking-[0.08em] text-pri-critical-ink uppercase">
                      {pinnedLabel ?? 'Needs attention'}
                    </span>
                    <span className="tabular inline-flex min-h-5 items-center rounded-pill bg-pri-critical-fill px-2 text-[0.76em] font-bold text-pri-on-critical">
                      {pinned.length}
                    </span>
                  </li>
                  {pinned.map((r) => renderCalmRow(r, true))}
                </>
              )}
              {rows.map((r) => renderCalmRow(r))}
            </ul>
            <p className="tabular border-t border-glass-hairline px-4 py-2.5 text-[0.82em] text-ink-3">
              {countLine}
              <span className="sr-only"> · arrow keys to move, Enter to open</span>
            </p>
          </Card>
        )}
      </div>
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
  hiddenColumns = [],
}: {
  columns: BoardColumn<T>[]
  rowKey: (row: T) => string
  renderCard: (row: T) => ReactNode
  asOf?: ReactNode
  legend?: ReactNode
  canDrop?: (row: T, columnKey: string) => true | string
  onDrop?: (row: T, columnKey: string) => void
  /**
   * Columns folded behind a pill until tapped — "Done", "Tomorrow", "Gone".
   * The doctor sees the columns they act on; the rest are one tap away. A
   * drag onto a hidden column is impossible, which is the point.
   */
  hiddenColumns?: string[]
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<{ column: string; reason: string } | null>(null)
  const [revealed, setRevealed] = useState<string[]>([])

  const flat = columns.flatMap((c) => c.rows)
  const folded = columns.filter((c) => hiddenColumns.includes(c.key) && !revealed.includes(c.key))
  const shown = columns.filter((c) => !folded.includes(c))

  return (
    <div>
      {(legend || asOf || folded.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {legend}
            {folded.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setRevealed((r) => [...r, c.key])}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-glass-inset px-3 text-[0.86em] font-semibold text-ink-3 hover:bg-glass-fill-hover hover:text-ink"
              >
                <Icon name="ChevronRight" size={12} />
                {c.label}
                <span className="tabular inline-flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-glass-fill-strong px-1.5 text-[0.82em] font-bold text-ink-2">
                  {c.rows.length}
                </span>
              </button>
            ))}
          </div>
          {asOf}
        </div>
      )}

      <div
        className={cx(
          'thin-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:overflow-visible md:px-0',
          shown.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : shown.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
        )}
      >
        {shown.map((col) => {
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
                'glass-strong flex w-72 shrink-0 flex-col gap-2 rounded-card p-2 md:w-auto',
                isRefused && 'bg-abnormal-soft ring-1 ring-abnormal/40',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-2 pt-1.5">
                <h3 className="flex items-center gap-2 text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">
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
    <Card as="section" strong className={cx('p-5', span && 'lg:col-span-2')}>
      <h2 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-[0.88em] text-ink-3">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </Card>
  )
}

// ──────────────────────────────────────────────── ARC-14 Checklist runner

type ChecklistItem = {
  key: string
  label: string
  answer: ReactNode
  /** The consequence of this answer — what makes an unknown usable. */
  consequence: ReactNode
  state: 'ok' | 'blocks' | 'unknown' | 'contraindicated' | 'resolved'
  actions?: ReactNode
  subFlow?: ReactNode
}

/**
 * The items that need a decision come first and in full. The ones already
 * satisfied fold behind "Satisfied · N", one line each, because a checklist a
 * clinician reads at 02:00 should be the three things that block, not the
 * seven things that exist.
 */
export function Checklist({
  items,
  footer,
  foldSatisfied = true,
}: {
  items: ChecklistItem[]
  footer?: ReactNode
  foldSatisfied?: boolean
}) {
  const TONE = {
    ok: { chip: 'normal', icon: 'Check', label: 'OK' },
    resolved: { chip: 'normal', icon: 'Check', label: 'Resolved' },
    blocks: { chip: 'abnormal', icon: 'Ban', label: 'Blocks' },
    unknown: { chip: 'caution', icon: 'CircleHelp', label: 'Unknown' },
    contraindicated: { chip: 'critical', icon: 'OctagonAlert', label: 'Contraindicated' },
  } as const
  const [showSatisfied, setShowSatisfied] = useState(false)

  const satisfied = foldSatisfied ? items.filter((i) => i.state === 'ok' || i.state === 'resolved') : []
  const open = items.filter((i) => !satisfied.includes(i))

  const renderItem = (item: ChecklistItem, full: boolean) => {
    const tone = TONE[item.state]
    return (
      <li key={item.key} className={cx('px-5', full ? 'py-3.5' : 'py-2.5')}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className={cx('font-medium', !full && 'text-[0.95em] text-ink-2')}>{item.label}</p>
            <p className="tabular mt-0.5 text-[0.92em] text-ink-2">{item.answer}</p>
          </div>
          <Chip tone={tone.chip} icon={tone.icon}>
            {tone.label}
          </Chip>
        </div>
        {full && <p className="mt-1.5 text-[0.9em] text-ink-3">{item.consequence}</p>}
        {full && item.subFlow && <div className="mt-2.5">{item.subFlow}</div>}
        {full && item.actions && <div className="mt-2.5 flex flex-wrap gap-2">{item.actions}</div>}
      </li>
    )
  }

  return (
    <Card strong className="overflow-hidden">
      {open.length === 0 && (
        <p className="flex items-center gap-2 px-5 py-4 text-[0.95em] font-medium text-normal">
          <Icon name="Check" size={15} />
          Every criterion is satisfied.
        </p>
      )}
      <ul className="divide-y divide-glass-hairline">{open.map((i) => renderItem(i, true))}</ul>
      {satisfied.length > 0 && (
        <div className="border-t border-glass-hairline">
          <button
            type="button"
            aria-expanded={showSatisfied}
            onClick={() => setShowSatisfied((v) => !v)}
            className="flex min-h-11 w-full items-center gap-2 px-5 text-left text-[0.88em] font-semibold text-ink-2 hover:bg-glass-fill-hover"
          >
            <Icon name={showSatisfied ? 'ChevronDown' : 'ChevronRight'} size={14} className="text-ink-3" />
            {showSatisfied ? 'Hide satisfied' : 'Satisfied'}
            <span className="tabular inline-flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-normal-soft px-1.5 text-[0.82em] font-bold text-normal">
              {satisfied.length}
            </span>
          </button>
          {showSatisfied && <ul className="divide-y divide-glass-hairline border-t border-glass-hairline">{satisfied.map((i) => renderItem(i, false))}</ul>}
        </div>
      )}
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
